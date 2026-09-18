import re
import logging
from typing import List, Tuple, AsyncGenerator, Optional

from together import AsyncTogether

from app.core.config import DEFAULT_LLM_MODEL_ID, settings
from app.services.security import security_service

logger = logging.getLogger(__name__)

MODEL_ID = settings.LLM_MODEL_ID or DEFAULT_LLM_MODEL_ID
DEFAULT_MAX_TOKENS = settings.LLM_MAX_TOKENS

# Keep the prompt bounded so large case payloads do not cause slow queueing,
# network timeouts, or runaway spend.
MAX_INPUT_TOKENS = 12000
MIN_COMPLETION_TOKENS = 256
MAX_COMPLETION_TOKENS = 4096

_client: Optional[AsyncTogether] = None
if settings.TOGETHER_API_KEY:
    try:
        _client = AsyncTogether(api_key=settings.TOGETHER_API_KEY)
    except Exception:
        logger.warning("Together client failed to initialize.")
        _client = None


class LLMService:
    """
    Handles Together-hosted LLM calls for legal research synthesis.

    Production constraints enforced here:
    - API key is never hardcoded
    - Redis-backed budget/rate checks are used when configured
    - source context is trimmed before inference
    - streaming and non-streaming answer paths share the same prompt contract
    """

    def __init__(self):
        self.client = _client
        self.model = MODEL_ID
        self.default_max_tokens = DEFAULT_MAX_TOKENS

    def _ensure_client(self):
        if self.client is None:
            if settings.TOGETHER_API_KEY:
                self.client = AsyncTogether(api_key=settings.TOGETHER_API_KEY)

            if self.client is None:
                raise RuntimeError(
                    "LLM Service Unavailable: Missing TOGETHER_API_KEY. "
                    "Please set this in your .env file to enable AI features."
                )

    def _resolve_max_tokens(self, max_tokens: Optional[int] = None) -> int:
        """
        Keeps completion size inside a predictable range for latency and spend.
        """
        token_budget = max_tokens or self.default_max_tokens or MAX_COMPLETION_TOKENS
        return max(MIN_COMPLETION_TOKENS, min(int(token_budget), MAX_COMPLETION_TOKENS))

    def _trim_chunks(self, chunks: List[str]) -> List[str]:
        """
        Trims chunks to fit within the input budget, distributing the budget
        evenly across all chunks so no single case overwhelms the prompt.
        """
        if not chunks:
            return []

        max_chars_total = MAX_INPUT_TOKENS * 4
        max_chars_per_chunk = max_chars_total // len(chunks)

        trimmed = []
        for chunk in chunks:
            if len(chunk) > max_chars_per_chunk:
                trimmed.append(chunk[:max_chars_per_chunk] + "... [TRUNCATED]")
            else:
                trimmed.append(chunk)

        return trimmed

    async def _run_security_checks(self, key: str, limit: int, window_seconds: int) -> None:
        """Enforce budget and rate checks before a paid provider call."""
        await security_service.check_budget_availability()
        await security_service.check_rate_limit(
            key,
            limit=limit,
            window_seconds=window_seconds,
        )

    async def _track_usage(self, prompt_tokens: int, completion_tokens: int) -> None:
        try:
            await security_service.track_usage(prompt_tokens, completion_tokens)
        except Exception:
            logger.warning("Failed to track usage.")

    def _build_answer_prompt(self, query: str, chunks: List[str]) -> Tuple[str, str]:
        system_instruction = (
            "You are a Senior Principal Law Clerk or a highly experienced Litigation Associate. "
            "Your task is to synthesize legal research into a partner-ready legal memo.\n\n"

            "### STRICT HIERARCHY OF AUTHORITY\n"
            "Organize the analysis in descending authority:\n"
            "1. **Landmark Precedents**: The most famous or controlling cases, including Supreme Court or key circuit decisions where available.\n"
            "2. **Key Rulings**: Other binding decisions, arranged from latest to oldest when dates are available.\n"
            "3. **Majority Opinions**: The core holding of the relevant cases.\n"
            "4. **Concurring Opinions**: Notable agreements with distinct reasoning.\n"
            "5. **Dissenting Opinions**: Important counter-arguments.\n\n"

            "### SOURCE BOUNDARIES\n"
            "- Use only the provided case context.\n"
            "- Do not invent cases, citations, dates, holdings, courts, or procedural history.\n"
            "- If the available context is thin, say what is missing instead of filling gaps.\n\n"

            "### FORMATTING RULES\n"
            "- **Bold** key legal principles and case names for rapid scanning.\n"
            "- Use `###` for main section headers.\n"
            "- Use bullets for readability.\n"
            "- Cite sources inline using brackets, for example: [1], [2].\n"
            "- End with a machine-readable footer exactly like: CITATIONS: [1, 2]\n\n"

            "### TONE & STYLE\n"
            "- Professional, objective, and direct.\n"
            "- No fluff. No disclaimers unless the evidence is insufficient.\n"
            "- Start directly with the answer.\n"
        )

        prompt_lines = [f"LEGAL QUESTION: {query}", "\nAVAILABLE CASE CONTEXT:"]
        for idx, chunk in enumerate(chunks, start=1):
            prompt_lines.append(f"SOURCE [{idx}]:\n{chunk}\n")

        prompt_lines.append(
            "\nProvide the analysis now following the strict hierarchy. "
            "End with 'CITATIONS: [x, y]' listing all source IDs used."
        )

        return system_instruction, "\n".join(prompt_lines)

    def _parse_answer_and_citations(self, full_text: str) -> Tuple[str, List[str]]:
        parts = re.split(r"CITATIONS?:", full_text, flags=re.IGNORECASE)
        answer_text = parts[0].strip()
        citations: List[str] = []

        if len(parts) > 1:
            cites = re.findall(r"\d+", parts[1])
            citations = sorted(set(str(int(cite)) for cite in cites), key=int)

        return answer_text, citations

    async def generate_answer(
        self,
        query: str,
        chunks: List[str],
        max_tokens: int = None,
    ) -> Tuple[str, List[str]]:
        """
        Generates a clean, readable legal answer.
        """
        self._ensure_client()
        await self._run_security_checks("llm_answer", limit=10, window_seconds=60)

        use_chunks = self._trim_chunks(chunks)
        token_budget = self._resolve_max_tokens(max_tokens)
        system_instruction, prompt = self._build_answer_prompt(query, use_chunks)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=token_budget,
                temperature=0.3,
            )

            usage = response.usage
            if usage:
                await self._track_usage(usage.prompt_tokens, usage.completion_tokens)

            full_text = response.choices[0].message.content.strip()
            return self._parse_answer_and_citations(full_text)

        except Exception as e:
            logger.error("LLM call failed (%s).", type(e).__name__)
            raise

    async def generate_answer_stream(
        self,
        query: str,
        chunks: List[str],
        max_tokens: int = None,
    ) -> AsyncGenerator[str, None]:
        """
        Generates a clean, readable legal answer and streams it chunk by chunk.
        Yields raw text tokens for SSE delivery.
        """
        self._ensure_client()
        await self._run_security_checks("llm_answer", limit=10, window_seconds=60)

        use_chunks = self._trim_chunks(chunks)
        token_budget = self._resolve_max_tokens(max_tokens)
        system_instruction, prompt = self._build_answer_prompt(query, use_chunks)

        try:
            response_stream = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=token_budget,
                temperature=0.3,
                stream=True,
            )

            completion_tokens = 0
            async for chunk in response_stream:
                if hasattr(chunk, "choices") and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content is not None:
                        completion_tokens += 1
                        yield delta.content

            prompt_tokens = (len(prompt) + len(system_instruction)) // 4
            await self._track_usage(prompt_tokens, completion_tokens)

        except Exception as e:
            logger.error("LLM stream failed (%s).", type(e).__name__)
            raise

    async def summarize_case(
        self,
        case_id: str,
        chunks: List[str],
        max_tokens: int = None,
    ) -> str:
        """
        Summarizes a case with strict formatting.
        """
        self._ensure_client()
        await self._run_security_checks("llm_summarize", limit=15, window_seconds=60)

        use_chunks = self._trim_chunks(chunks)
        token_budget = self._resolve_max_tokens(max_tokens)

        system_prompt = (
            "You are an expert legal summarizer. Generate a clean case brief.\n"
            "Use only the provided case excerpts.\n"
            "Do not invent missing facts, dates, holdings, or procedural history.\n"
            "STYLE: Professional, concise, minimal markdown.\n"
            "SECTIONS: Use '###' headers for: Facts, Issue, Holding, Reasoning."
        )

        user_prompt = [f"TECHNICAL SUMMARY REQUEST (ID: {case_id})\n", "CASE RECORD EXCERPTS:\n"]
        for idx, chunk in enumerate(use_chunks, start=1):
            user_prompt.append(f"\n[RECORD {idx}]:\n{chunk}")

        prompt = "".join(user_prompt)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=token_budget,
            )

            usage = response.usage
            if usage:
                await self._track_usage(usage.prompt_tokens, usage.completion_tokens)

            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error("LLM summarization failed (%s).", type(e).__name__)
            raise


llm_service = LLMService()
