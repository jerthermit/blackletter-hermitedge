import logging
import asyncio
import time
import json
import re
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.courtlistener_service import courtlistener_service
from app.services.llm_service import llm_service
from app.services.security import security_service

router = APIRouter()
logger = logging.getLogger(__name__)

MIN_USABLE_CONTEXT_CHARS = 300
MAX_ANALYSIS_CASES = 3
SOURCE_EXCERPT_CHARS = 520
MAX_QUERY_CHARS = 500


# ─── Data Models ─────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    id: int
    name: str
    citation: str
    date: str
    snippet: str
    absolute_url: Optional[str] = None


class AnalysisRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=MAX_QUERY_CHARS)


class AnalysisResponse(BaseModel):
    answer: str
    citations: List[str]
    sources: List[SearchResult]
    processing_time_ms: float
    status: str = "success"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _sse_message(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _parse_citations(full_text: str) -> Tuple[str, List[str]]:
    parts = re.split(r"CITATIONS?:", full_text, flags=re.IGNORECASE)
    answer_text = parts[0].strip()
    citations: List[str] = []

    if len(parts) > 1:
        cites = re.findall(r"\d+", parts[1])
        citations = sorted(set(str(int(cite)) for cite in cites), key=int)

    return answer_text, citations


def _case_value(case: Any, key: str, default: Any = None) -> Any:
    if isinstance(case, dict):
        return case.get(key, default)

    return getattr(case, key, default)


def _case_id(case: Any) -> str:
    return str(_case_value(case, "id", ""))


def _case_label(case: Any) -> str:
    name = _case_value(case, "name", "Unknown Case")
    citation = _case_value(case, "citation", "No Citation")
    date = _case_value(case, "date", "Undated")
    court = _case_value(case, "court", "")

    court_line = f"\nCOURT: {court}" if court else ""

    return (
        f"CASE: {name}\n"
        f"CITATION: {citation}\n"
        f"DATE: {date}"
        f"{court_line}"
    )


def _is_weak_preview(snippet: str) -> bool:
    normalized = snippet.lower()

    return (
        "search preview unavailable" in normalized
        or "full opinion text is available" in normalized
        or "official record retrieved" in normalized
        or "open the source record to review the full opinion text" in normalized
    )


def _usable_context_for_case(case: Any, fetched_text: Optional[str]) -> Optional[str]:
    snippet = _case_value(case, "snippet", "") or ""
    text = fetched_text or ""

    if len(text.strip()) >= MIN_USABLE_CONTEXT_CHARS:
        return text.strip()

    if snippet and not _is_weak_preview(snippet) and len(snippet.strip()) >= 80:
        return snippet.strip()

    return None


def _build_source_excerpt(text: str) -> str:
    """
    Creates a compact authority preview from fetched source text.

    This is only for display. The LLM still receives the fuller source context.
    """
    clean_text = re.sub(r"\s+", " ", text).strip()

    if len(clean_text) <= SOURCE_EXCERPT_CHARS:
        return clean_text

    excerpt = clean_text[:SOURCE_EXCERPT_CHARS].rsplit(" ", 1)[0].strip()
    return f"{excerpt}..."


def _case_with_excerpt(case: Any, content: str) -> Any:
    """
    Returns a source object with a useful snippet while preserving all existing fields.
    """
    excerpt = _build_source_excerpt(content)

    if isinstance(case, dict):
        return {
            **case,
            "snippet": excerpt,
        }

    return case


async def _enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    await security_service.check_rate_limit(
        key,
        limit=limit,
        window_seconds=window_seconds,
    )


async def _build_analysis_context(
    search_results: List[Any],
    max_cases: int = MAX_ANALYSIS_CASES,
) -> Tuple[List[str], List[Any]]:
    top_cases = search_results[:max_cases]
    tasks = [courtlistener_service.get_case_text(_case_id(case)) for case in top_cases]
    case_texts = await asyncio.gather(*tasks)

    valid_chunks: List[str] = []
    valid_sources: List[Any] = []

    for index, text in enumerate(case_texts):
        case = top_cases[index]
        content = _usable_context_for_case(case, text)

        if content:
            valid_chunks.append(f"{_case_label(case)}\n\nOPINION TEXT:\n{content}")
            valid_sources.append(_case_with_excerpt(case, content))
        else:
            logger.info(
                "Skipping weak analysis source id=%s name=%s",
                _case_id(case),
                _case_value(case, "name", "Unknown Case"),
            )

    return valid_chunks, valid_sources


def _analysis_response(
    answer: str,
    citations: List[str],
    sources: List[Any],
    start_time: float,
    status: str = "success",
) -> AnalysisResponse:
    return AnalysisResponse(
        answer=answer,
        citations=citations,
        sources=sources,
        processing_time_ms=(time.perf_counter() - start_time) * 1000,
        status=status,
    )


def _no_results_response(start_time: float) -> AnalysisResponse:
    return _analysis_response(
        answer=(
            "**No relevant authorities found.**\n\n"
            "The source search did not return usable precedential opinions for this query. "
            "Try a more specific doctrine, statute, citation, party name, or jurisdiction."
        ),
        citations=[],
        sources=[],
        start_time=start_time,
        status="no_results",
    )


def _data_error_response(search_results: List[Any], start_time: float) -> AnalysisResponse:
    return _analysis_response(
        answer=(
            "**Insufficient source text.**\n\n"
            "The search found candidate records, but the top source records did not expose "
            "enough readable opinion text to support a drafted memo."
        ),
        citations=[],
        sources=search_results[:MAX_ANALYSIS_CASES],
        start_time=start_time,
        status="data_error",
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[SearchResult])
async def search_cases(
    q: str = Query(..., min_length=3, max_length=MAX_QUERY_CHARS, description="Legal query"),
    limit: int = Query(5, ge=1, le=10),
):
    """
    Standard Search: Returns case metadata and snippets only.
    Fast and cheap. No LLM usage.
    """
    start_time = time.perf_counter()

    await _enforce_rate_limit("search_endpoint", limit=20, window_seconds=60)

    try:
        results = await courtlistener_service.search_cases(q, limit=limit)

        elapsed = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Search completed in %.2fms (query_chars=%s, results=%s).",
            elapsed,
            len(q),
            len(results),
        )

        return results
    except Exception as e:
        logger.error("Search endpoint failed (%s).", type(e).__name__)
        raise HTTPException(status_code=503, detail="Legal Search Unavailable. Please try again later.")


@router.post("/analysis", response_model=AnalysisResponse)
async def analyze_legal_question(request: AnalysisRequest):
    """
    Deep Analysis (RAG):
    1. Search top candidate cases
    2. Fetch top opinion texts in parallel
    3. Generate cited answer via LLM only when usable source text exists
    """
    start_time = time.perf_counter()

    await _enforce_rate_limit("analysis_endpoint", limit=5, window_seconds=60)
    await security_service.check_budget_availability()

    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info("Starting analysis (query_chars=%s).", len(query))

    try:
        search_results = await courtlistener_service.search_cases(query, limit=5)
    except Exception as e:
        logger.error("Analysis search phase failed (%s).", type(e).__name__)
        raise HTTPException(status_code=503, detail="Search Service Unavailable")

    if not search_results:
        return _no_results_response(start_time)

    try:
        valid_chunks, valid_sources = await _build_analysis_context(search_results)
    except Exception as e:
        logger.error("Analysis text-fetch phase failed (%s).", type(e).__name__)
        raise HTTPException(status_code=503, detail="Unable to retrieve case documents.")

    if not valid_chunks:
        return _data_error_response(search_results, start_time)

    try:
        answer, citations = await llm_service.generate_answer(
            query=query,
            chunks=valid_chunks,
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Analysis completed in {elapsed_ms:.2f}ms using {len(valid_chunks)} sources.")

        return AnalysisResponse(
            answer=answer,
            citations=citations,
            sources=valid_sources,
            processing_time_ms=elapsed_ms,
        )

    except HTTPException:
        raise
    except RuntimeError:
        logger.error("AI service configuration error.")
        raise HTTPException(
            status_code=503,
            detail="AI Service Unavailable.",
        )
    except Exception as e:
        logger.error("Analysis generation failed (%s).", type(e).__name__)
        raise HTTPException(status_code=500, detail="An internal error occurred during analysis.")


@router.post("/analysis/stream")
async def analyze_legal_question_stream(request: AnalysisRequest):
    """
    Streaming Deep Analysis (RAG).
    Outputs Server-Sent Events for fast time-to-first-token UI updates.
    """
    start_time = time.perf_counter()

    await _enforce_rate_limit("analysis_endpoint", limit=5, window_seconds=60)
    await security_service.check_budget_availability()

    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    logger.info("Starting streaming analysis (query_chars=%s).", len(query))

    try:
        search_results = await courtlistener_service.search_cases(query, limit=5)
    except Exception as e:
        logger.error("Streaming analysis search failed (%s).", type(e).__name__)
        raise HTTPException(status_code=503, detail="Search Service Unavailable")

    async def event_generator():
        public_sources = [
            SearchResult.model_validate(source).model_dump()
            for source in search_results
        ]
        yield _sse_message({"sources": public_sources})

        if not search_results:
            result = _no_results_response(start_time)
            yield _sse_message({"result": result.model_dump()})
            yield "data: [DONE]\n\n"
            return

        try:
            valid_chunks, valid_sources = await _build_analysis_context(search_results)
        except Exception as e:
            logger.error("Streaming text-fetch failed (%s).", type(e).__name__)
            yield _sse_message({"error": "Unable to retrieve case documents."})
            yield "data: [DONE]\n\n"
            return

        if not valid_chunks:
            result = _data_error_response(search_results, start_time)
            yield _sse_message({"result": result.model_dump()})
            yield "data: [DONE]\n\n"
            return

        full_text = ""

        try:
            async for token in llm_service.generate_answer_stream(query=query, chunks=valid_chunks):
                full_text += token
                yield _sse_message({"chunk": token})

            answer_text, citations = _parse_citations(full_text)

            final_result = _analysis_response(
                answer=answer_text,
                citations=citations,
                sources=valid_sources,
                start_time=start_time,
                status="success",
            )

            logger.info(
                "Streaming analysis completed in %.2fms using %s sources.",
                final_result.processing_time_ms,
                len(valid_sources),
            )

            yield _sse_message({"result": final_result.model_dump()})
            yield "data: [DONE]\n\n"

        except HTTPException as e:
            yield _sse_message({"error": str(e.detail)})
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("Streaming generation failed (%s).", type(e).__name__)
            yield _sse_message({"error": "An internal error occurred during streaming analysis."})
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
