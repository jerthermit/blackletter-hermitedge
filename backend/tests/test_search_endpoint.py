from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _case(case_id: int = 1) -> dict:
    return {
        "id": case_id,
        "name": "Case One",
        "citation": "123 F.3d 456",
        "date": "2024-01-01",
        "snippet": "A substantive opinion excerpt suitable for display and analysis.",
        "absolute_url": f"https://www.courtlistener.com/opinion/{case_id}/",
    }


def test_health():
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "online"
    assert body["version"]
    assert body["security"] in {"active", "development-only", "unavailable"}
    assert "cors_origins" not in body


def test_search_success(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service

    captured = {}

    async def fake_search(query, limit=5):
        captured["query"] = query
        captured["limit"] = limit
        return [_case()]

    monkeypatch.setattr(courtlistener_service, "search_cases", fake_search)

    response = client.get("/api/search", params={"q": "test query", "limit": 5})

    assert response.status_code == 200
    assert response.json()[0]["id"] == 1
    assert captured == {"query": "test query", "limit": 5}


def test_search_provider_failure_is_not_reported_as_no_results(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service

    async def fake_search(query, limit=5):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(courtlistener_service, "search_cases", fake_search)

    response = client.get("/api/search", params={"q": "test query"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Legal Search Unavailable. Please try again later."


def test_analysis_success(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service
    from app.services.llm_service import llm_service

    async def fake_search(query, limit=5):
        return [_case()]

    async def fake_text(case_id):
        return "Case One " + ("opinion text " * 40)

    async def fake_generate(query, chunks, max_tokens=None):
        assert query == "What is the rule?"
        assert len(chunks) == 1
        return "Answer text", ["1"]

    monkeypatch.setattr(courtlistener_service, "search_cases", fake_search)
    monkeypatch.setattr(courtlistener_service, "get_case_text", fake_text)
    monkeypatch.setattr(llm_service, "generate_answer", fake_generate)

    response = client.post("/api/analysis", json={"query": "What is the rule?"})

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "Answer text"
    assert body["citations"] == ["1"]
    assert body["sources"][0]["id"] == 1


def test_stream_emits_sources_before_answer(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service
    from app.services.llm_service import llm_service

    async def fake_search(query, limit=5):
        return [_case()]

    async def fake_text(case_id):
        return "Case One " + ("opinion text " * 40)

    async def fake_stream(query, chunks, max_tokens=None):
        yield "Answer text. CITATIONS: [1]"

    monkeypatch.setattr(courtlistener_service, "search_cases", fake_search)
    monkeypatch.setattr(courtlistener_service, "get_case_text", fake_text)
    monkeypatch.setattr(llm_service, "generate_answer_stream", fake_stream)

    response = client.post("/api/analysis/stream", json={"query": "What is the rule?"})

    assert response.status_code == 200
    assert response.text.index('"sources"') < response.text.index('"chunk"')


def test_search_rejects_unbounded_limit():
    response = client.get("/api/search", params={"q": "test query", "limit": 1000})

    assert response.status_code == 422


def test_rate_limit_is_not_swallowed(monkeypatch):
    from app.api import search as search_api

    async def reject(*args, **kwargs):
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    monkeypatch.setattr(search_api.security_service, "check_rate_limit", reject)

    response = client.get("/api/search", params={"q": "test query"})

    assert response.status_code == 429
    assert response.json()["detail"] == "Rate limit exceeded."


def test_budget_block_is_not_swallowed_by_endpoint(monkeypatch):
    from app.api import search as search_api

    async def reject():
        raise HTTPException(status_code=402, detail="Demo budget exceeded.")

    monkeypatch.setattr(search_api.security_service, "check_budget_availability", reject)

    response = client.post("/api/analysis", json={"query": "What is the rule?"})

    assert response.status_code == 402
    assert response.json()["detail"] == "Demo budget exceeded."
