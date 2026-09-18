from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_summary_text_unavailable(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service

    async def fake_text(case_id):
        return None

    monkeypatch.setattr(courtlistener_service, "get_case_text", fake_text)

    response = client.get("/api/summarize/999")

    assert response.status_code == 200
    assert response.json()["status"] == "data_unavailable"


def test_summary_success(monkeypatch):
    from app.services.courtlistener_service import courtlistener_service
    from app.services.llm_service import llm_service

    async def fake_text(case_id):
        return "Opinion text " * 40

    async def fake_summarize(case_id, chunks, max_tokens=None):
        assert case_id == "123"
        assert len(chunks) == 1
        return "A concise case summary."

    monkeypatch.setattr(courtlistener_service, "get_case_text", fake_text)
    monkeypatch.setattr(llm_service, "summarize_case", fake_summarize)

    response = client.get("/api/summarize/123")

    assert response.status_code == 200
    body = response.json()
    assert body["case_id"] == "123"
    assert body["summary"] == "A concise case summary."
    assert body["status"] == "success"


def test_summary_rejects_non_numeric_case_id():
    response = client.get("/api/summarize/not-a-case")

    assert response.status_code == 422
