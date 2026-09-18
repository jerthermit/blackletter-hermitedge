# File: backend/app/api/summarize.py

import logging
import time
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from app.services.courtlistener_service import courtlistener_service
from app.services.llm_service import llm_service
from app.services.security import security_service

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Data Models ─────────────────────────────────────────────────────────────

class SummaryResponse(BaseModel):
    case_id: str
    summary: str
    processing_time_ms: float
    status: str = "success"

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/summarize/{case_id}", response_model=SummaryResponse)
async def summarize_case_endpoint(
    case_id: str = Path(
        ...,
        min_length=1,
        max_length=20,
        pattern=r"^\d+$",
        description="The numeric CourtListener opinion ID",
    )
):
    """
    Generates a structured technical summary (IRAC style) for a specific case.
    Uses the configured Together AI model.
    """
    start_time = time.perf_counter()
    logger.info(f"Received summary request for Case ID: {case_id}")

    # 1. Rate Limit (Expensive Operation)
    await security_service.check_rate_limit("summarize_endpoint", limit=10, window_seconds=60)
    await security_service.check_budget_availability()

    # 2. Fetch Full Case Text
    try:
        case_text = await courtlistener_service.get_case_text(case_id)
    except Exception as e:
        logger.error("CourtListener fetch failed (%s).", type(e).__name__)
        raise HTTPException(status_code=503, detail="Legal Database Unavailable")

    if not case_text or len(case_text) < 200:
        # Fail gracefully if the case has no opinion text
        return SummaryResponse(
            case_id=case_id,
            summary="**Text Unavailable.**\n\nThe full opinion text for this case is not available in the public CourtListener database.",
            processing_time_ms=(time.perf_counter() - start_time) * 1000,
            status="data_unavailable"
        )

    # 3. Generate Summary via LLM
    try:
        # We pass the text as a single chunk (LLM Service handles trimming)
        summary = await llm_service.summarize_case(
            case_id=case_id,
            chunks=[case_text]
        )
        
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Summary generated in {elapsed_ms:.2f}ms")

        return SummaryResponse(
            case_id=case_id,
            summary=summary,
            processing_time_ms=elapsed_ms,
            status="success"
        )

    except HTTPException:
        raise
    except RuntimeError:
        # LLM Service specific error (e.g., Missing Key)
        logger.error("AI service configuration error.")
        raise HTTPException(
            status_code=503, 
            detail="AI Service Unavailable."
        )
    except Exception as e:
        logger.error("Summarization failed (%s).", type(e).__name__)
        raise HTTPException(status_code=500, detail="Failed to generate summary.")
