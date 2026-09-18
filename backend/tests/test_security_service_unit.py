import asyncio

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.main import create_app
from app.services.courtlistener_service import (
    MAX_CASE_LOOKUP_ENTRIES,
    MAX_OPINION_TEXT_CHARS,
    MAX_TEXT_CACHE_ENTRIES,
    CourtListenerService,
)
from app.services.security import SecurityService


def _unconfigured_service() -> SecurityService:
    service = SecurityService.__new__(SecurityService)
    service.redis = None
    service.enabled = False
    service.configured = False
    service.credentials_complete = False
    return service


def test_required_security_gate_fails_closed(monkeypatch):
    service = _unconfigured_service()
    monkeypatch.setattr(settings, "REQUIRE_SECURITY_GATE", True)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.check_rate_limit("test", limit=1))

    assert exc_info.value.status_code == 503


def test_development_security_gate_can_be_disabled(monkeypatch):
    service = _unconfigured_service()
    monkeypatch.setattr(settings, "REQUIRE_SECURITY_GATE", False)

    asyncio.run(service.check_rate_limit("test", limit=1))


def test_courtlistener_caches_are_bounded():
    service = CourtListenerService()

    for index in range(MAX_CASE_LOOKUP_ENTRIES + 3):
        service._remember_case(str(index), {"name": f"Case {index}"})

    for index in range(MAX_TEXT_CACHE_ENTRIES + 3):
        service._remember_text(str(index), f"Opinion {index}")

    assert len(service._case_lookup) == MAX_CASE_LOOKUP_ENTRIES
    assert len(service._text_cache) == MAX_TEXT_CACHE_ENTRIES
    assert "0" not in service._case_lookup
    assert "0" not in service._text_cache


def test_opinion_text_is_bounded():
    service = CourtListenerService()
    text = "x" * (MAX_OPINION_TEXT_CHARS + 100)

    validated = service._validated_case_text("1", text, "test")

    assert validated is not None
    assert len(validated) == MAX_OPINION_TEXT_CHARS


def test_wildcard_cors_origin_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "*")

    with pytest.raises(RuntimeError, match="explicit origins"):
        create_app()


def test_production_app_hides_schema_routes(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)

    paths = {route.path for route in create_app().routes}

    assert "/api/docs" not in paths
    assert "/api/openapi.json" not in paths
