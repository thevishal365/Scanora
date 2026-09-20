import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import RATE_LIMIT_ANALYZE, RATE_LIMIT_CHAT, app
from report_upload import HUMAN_ERRORS
from services.analysis_token import seal_analysis

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png-body"


def _analysis():
    return {
        "overall_summary": "Fixture summary",
        "reports": [
            {
                "source_id": "source-1",
                "report_name": "Test Report",
                "summary": "Fixture summary",
                "key_findings": ["Fixture finding"],
                "important_values": [],
                "simple_explanation": "Fixture explanation",
            }
        ],
    }


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def patched_analyze(monkeypatch):
    calls = []

    async def fake_analyze_report_files(files, source_ids=None):
        calls.append(files)
        return _analysis()

    monkeypatch.setattr(main_module, "analyze_report_files", fake_analyze_report_files)
    return calls


@pytest.fixture()
def patched_chat(monkeypatch):
    calls = []

    async def fake_answer(report_context, history, user_message):
        calls.append(user_message)
        return "Fixture answer"

    monkeypatch.setattr(main_module, "answer_report_question", fake_answer)
    return calls


def test_analyze_rate_limit_returns_429(client, patched_analyze):
    limit, _window = RATE_LIMIT_ANALYZE
    for _ in range(limit):
        response = client.post(
            "/api/analyze",
            files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
        )
        assert response.status_code == 200
    assert len(patched_analyze) == limit

    throttled = client.post(
        "/api/analyze",
        files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
    )
    assert throttled.status_code == 429
    assert throttled.json()["detail"] == HUMAN_ERRORS["rate_limited"]
    assert "retry-after" in {key.lower() for key in throttled.headers}
    # The throttled request never reaches Gemini.
    assert len(patched_analyze) == limit


def test_chat_rate_limit_returns_429(client, patched_chat):
    token = seal_analysis(_analysis())
    limit, _window = RATE_LIMIT_CHAT
    for _ in range(limit):
        response = client.post(
            "/api/chat",
            json={"analysis_id": token, "message": "Hello", "messages": []},
        )
        assert response.status_code == 200
    assert len(patched_chat) == limit

    throttled = client.post(
        "/api/chat",
        json={"analysis_id": token, "message": "Hello", "messages": []},
    )
    assert throttled.status_code == 429
    assert throttled.json()["detail"] == HUMAN_ERRORS["rate_limited"]
    assert len(patched_chat) == limit


def test_analyze_and_chat_limits_are_independent(client, patched_analyze, patched_chat):
    analyze_limit, _ = RATE_LIMIT_ANALYZE
    for _ in range(analyze_limit):
        assert (
            client.post(
                "/api/analyze",
                files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
            ).status_code
            == 200
        )
    assert (
        client.post(
            "/api/analyze",
            files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
        ).status_code
        == 429
    )

    # Exhausting the analyze bucket must not affect chat.
    token = seal_analysis(_analysis())
    response = client.post(
        "/api/chat",
        json={"analysis_id": token, "message": "Hello", "messages": []},
    )
    assert response.status_code == 200
    assert len(patched_chat) == 1
