import os
from pathlib import Path
from dotenv import load_dotenv

DEFAULT_LLM_MODEL_ID = "deepseek-ai/DeepSeek-V4-Flash-0731"

# ─── Load .env ─────────────────────────────────────────────────────────────────
# Assumes your .env lives at the project root, two levels above this file.
env_path = Path(__file__).parents[2] / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)

# ─── Helpers ───────────────────────────────────────────────────────────────────
def str_env(key: str, default: str = "") -> str:
    return os.getenv(key, default)

def bool_env(key: str, default: bool) -> bool:
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def int_env(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default

def float_env(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, str(default)))
    except ValueError:
        return default

# ─── Settings ──────────────────────────────────────────────────────────────────
class Settings:
    """
    Application configuration.

    The stack is intentionally production-aware:
    - CourtListener is the legal data source.
    - Together AI handles legal synthesis.
    - Redis is optional, but enables budget and rate guardrails.
    """
    PROJECT_NAME: str = str_env("PROJECT_NAME", "Blackletter")
    VERSION: str = str_env("VERSION", "0.2.4")

    DEBUG: bool = bool_env("DEBUG", False)
    REQUIRE_SECURITY_GATE: bool = bool_env("REQUIRE_SECURITY_GATE", not DEBUG)

    # 1. CourtListener API v4 (The Data Source)
    COURTLISTENER_API_KEY: str = str_env("COURTLISTENER_API_KEY", "")

    # 2. Together AI LLM (The Legal Synthesis Layer)
    TOGETHER_API_KEY: str = str_env("TOGETHER_API_KEY", "")

    # Current Together model; override explicitly when testing another model.
    LLM_MODEL_ID: str = str_env(
        "LLM_MODEL_ID", DEFAULT_LLM_MODEL_ID
    )

    # Keep completion size bounded for predictable latency and cost.
    LLM_MAX_TOKENS: int = int_env("LLM_MAX_TOKENS", 4096)

    # 3. The Hermit Gate (Budget & State)
    # Upstash Redis is optional. When configured, it tracks spend and enforces
    # budget/rate controls across serverless reloads.
    UPSTASH_REDIS_REST_URL: str = str_env("UPSTASH_REDIS_REST_URL", "")
    UPSTASH_REDIS_REST_TOKEN: str = str_env("UPSTASH_REDIS_REST_TOKEN", "")

    # Absolute monthly limit in USD.
    MONTHLY_SPEND_CAP_USD: float = float_env("MONTHLY_SPEND_CAP_USD", 4.80)

    # 4. Security
    ALLOWED_ORIGINS: str = str_env(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    )

settings = Settings()
