import logging
import time
from typing import Optional

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

COST_PER_1M_TOKENS = 1.00

try:
    from upstash_redis.asyncio import Redis
except ImportError:
    Redis = None
    logger.warning("The upstash-redis package is unavailable.")


class SecurityService:
    """Centralized budget and rate controls for the public demo."""

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.enabled = False
        redis_url = settings.UPSTASH_REDIS_REST_URL
        redis_token = settings.UPSTASH_REDIS_REST_TOKEN
        self.configured = bool(redis_url or redis_token)
        self.credentials_complete = bool(redis_url and redis_token)

        if Redis is None:
            self._log_unavailable("missing dependency")
            return

        if not self.configured:
            self._log_unavailable("not configured")
            return

        if not self.credentials_complete:
            self._log_unavailable("incomplete credentials")
            return

        try:
            self.redis = Redis(url=redis_url, token=redis_token)
            self.enabled = True
            logger.info("Security gate configured.")
        except Exception:
            logger.error("Security gate initialization failed.")
            self.enabled = False

    @property
    def fail_closed(self) -> bool:
        return settings.REQUIRE_SECURITY_GATE or self.configured

    def _log_unavailable(self, reason: str) -> None:
        level = logging.ERROR if self.fail_closed else logging.WARNING
        logger.log(level, "Security gate unavailable: %s", reason)

    def _raise_if_unavailable(self, reason: str) -> None:
        self._log_unavailable(reason)
        if self.fail_closed:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Demo safety controls are temporarily unavailable.",
            )

    def status_label(self) -> str:
        if self.enabled:
            return "active"
        if self.fail_closed:
            return "unavailable"
        return "development-only"

    async def get_current_spend(self) -> float:
        """Return the current estimated monthly spend from Redis."""
        if not self.enabled or not self.redis:
            self._raise_if_unavailable("counter backend is not ready")
            return 0.0

        try:
            current_month = time.strftime("%Y-%m")
            key = f"spend:{current_month}"
            spend = await self.redis.get(key)
            return float(spend) if spend else 0.0
        except Exception:
            self._raise_if_unavailable("spend lookup failed")
            return 0.0

    async def check_budget_availability(self) -> None:
        """Reject requests after the configured estimated monthly cap."""
        limit = settings.MONTHLY_SPEND_CAP_USD
        current = await self.get_current_spend()

        if current >= limit:
            logger.critical("Monthly demo budget exceeded: %.4f / %.2f", current, limit)
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Demo budget exceeded. Access is paused.",
            )

    async def check_rate_limit(
        self,
        key_prefix: str,
        limit: int,
        window_seconds: int = 60,
    ) -> None:
        """Apply a Redis-backed fixed-window rate limit."""
        if not self.enabled or not self.redis:
            self._raise_if_unavailable("rate-limit backend is not ready")
            return

        window_index = int(time.time() / window_seconds)
        key = f"ratelimit:{key_prefix}:{window_index}"

        try:
            count = await self.redis.incr(key)

            if count == 1:
                await self.redis.expire(key, window_seconds + 10)

            if count > limit:
                logger.warning("Rate limit reached for %s (%s/%s)", key_prefix, count, limit)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded. Please wait before trying again.",
                )
        except HTTPException:
            raise
        except Exception:
            self._raise_if_unavailable("rate-limit check failed")

    async def track_usage(self, prompt_tokens: int, completion_tokens: int) -> None:
        """Record estimated token spend after a provider response."""
        if not self.enabled or not self.redis:
            self._log_unavailable("usage counter is not ready")
            return

        total_tokens = prompt_tokens + completion_tokens
        cost_usd = (total_tokens / 1_000_000) * COST_PER_1M_TOKENS

        current_month = time.strftime("%Y-%m")
        key = f"spend:{current_month}"

        try:
            await self.redis.incrbyfloat(key, cost_usd)
        except Exception:
            logger.error("Usage tracking failed.")


security_service = SecurityService()
