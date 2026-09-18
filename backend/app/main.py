# File: backend/app/main.py

import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.search import router as search_router
from app.api.summarize import router as summarize_router
from app.services.security import security_service

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("hermit_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify the demo safety controls before accepting production traffic."""
    logger.info("Verifying security gate...")
    try:
        current_spend = await security_service.get_current_spend()
        logger.info(
            "Current estimated demo spend: $%.4f / $%.2f",
            current_spend,
            settings.MONTHLY_SPEND_CAP_USD,
        )
    except Exception as e:
        if security_service.fail_closed:
            raise RuntimeError("Required security gate is unavailable.") from e
        logger.warning("Security gate disabled for local development.")

    yield

    logger.info("Shutting down...")

def create_app() -> FastAPI:
    """
    Application Factory
    """
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
        docs_url="/api/docs" if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
        redoc_url=None,
    )

    # ─── CORS ───────────────────────────────────────────────────────────────────
    # Enterprise-Grade CORS Configuration:
    # Strictly enforces origins while defensively parsing environment variables. 
    # Safely strips accidental quotes, whitespace, and trailing slashes that 
    # commonly cause Starlette to throw '400 Bad Request' on OPTIONS preflights.
    
    origins = []
    if settings.ALLOWED_ORIGINS:
        for origin in settings.ALLOWED_ORIGINS.split(","):
            # Clean: remove spaces, remove accidental quotes, remove trailing slashes
            cleaned = origin.strip().strip("'").strip('"').rstrip("/")
            if cleaned:
                origins.append(cleaned)
    
    # Fallback to local defaults if strictly empty
    if not origins:
        origins = ["http://localhost:5173", "http://localhost:3000"]
        logger.warning("No valid ALLOWED_ORIGINS found. Defaulting to localhost.")

    if "*" in origins:
        raise RuntimeError("ALLOWED_ORIGINS must list explicit origins; wildcard access is not allowed.")

    logger.info(f"🛡️ CORS Enabled for Origins: {origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )

    # ─── Exception Handlers ─────────────────────────────────────────────────────
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """
        Standardizes error responses for the Frontend.
        """
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # ─── Routes ─────────────────────────────────────────────────────────────────
    
    app.include_router(search_router, prefix="/api")
    app.include_router(summarize_router, prefix="/api")

    @app.get("/api/health", tags=["health"])
    async def health_check():
        """
        Simple heartbeat endpoint.
        """
        return {
            "status": "online",
            "version": settings.VERSION,
            "security": security_service.status_label(),
        }

    return app

# ASGI Entrypoint
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.DEBUG,
    )
