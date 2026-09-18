import asyncio

import pytest
from fastapi import HTTPException

from app.core.config import DEFAULT_LLM_MODEL_ID
from app.services.llm_service import (
    LLMService,
    MAX_COMPLETION_TOKENS,
    MAX_INPUT_TOKENS,
    MIN_COMPLETION_TOKENS,
)


def test_default_model_uses_current_together_model():
    assert DEFAULT_LLM_MODEL_ID == "deepseek-ai/DeepSeek-V4-Flash-0731"
    assert "gpt-oss" not in DEFAULT_LLM_MODEL_ID


class DummyClient:
    class chat:
        class completions:
            @staticmethod
            async def create(model, messages, max_tokens, temperature=None, stream=False):
                class Choice:
                    def __init__(self, content):
                        self.message = type("M", (), {"content": content})

                class Usage:
                    prompt_tokens = 100
                    completion_tokens = 25

                class Resp:
                    def __init__(self):
                        self.choices = [Choice("Answer part. CITATIONS: [1,2]")]
                        self.usage = Usage()

                return Resp()


@pytest.fixture(autouse=True)
def patch_client(monkeypatch):
    import app.services.llm_service as mod

    monkeypatch.setattr(mod, "_client", DummyClient())


@pytest.fixture
def llm_service():
    return LLMService()


def test_trim_chunks_under_limit(llm_service):
    chunks = ["a" * (MAX_INPUT_TOKENS * 4 // 2)]
    trimmed = llm_service._trim_chunks(chunks)

    assert trimmed == chunks


def test_trim_chunks_exceeds_limit(llm_service):
    big = "a" * (MAX_INPUT_TOKENS * 4)
    small = "short"
    chunks = [big, small]

    trimmed = llm_service._trim_chunks(chunks)

    assert len(trimmed) == 2
    assert trimmed[0].endswith("... [TRUNCATED]")
    assert len(trimmed[0]) < len(big)
    assert trimmed[1] == small


def test_resolve_max_tokens_clamps_to_minimum(llm_service):
    assert llm_service._resolve_max_tokens(1) == MIN_COMPLETION_TOKENS


def test_resolve_max_tokens_clamps_to_maximum(llm_service):
    assert llm_service._resolve_max_tokens(MAX_COMPLETION_TOKENS + 5000) == MAX_COMPLETION_TOKENS


def test_build_answer_prompt_includes_source_boundaries(llm_service):
    system_instruction, prompt = llm_service._build_answer_prompt(
        "What is the rule?",
        ["Case text"],
    )

    assert "Use only the provided case context." in system_instruction
    assert "Do not invent cases" in system_instruction
    assert "LEGAL QUESTION: What is the rule?" in prompt
    assert "SOURCE [1]:" in prompt
    assert "Case text" in prompt


def test_generate_answer_defaults(llm_service):
    answer, citations = asyncio.run(llm_service.generate_answer("Q?", ["text"]))

    assert "Answer part." in answer
    assert citations == ["1", "2"]


def test_budget_block_is_not_swallowed(monkeypatch, llm_service):
    import app.services.llm_service as mod

    async def reject():
        raise HTTPException(status_code=402, detail="Demo budget exceeded.")

    monkeypatch.setattr(mod.security_service, "check_budget_availability", reject)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(llm_service.generate_answer("Q?", ["text"]))

    assert exc_info.value.status_code == 402
