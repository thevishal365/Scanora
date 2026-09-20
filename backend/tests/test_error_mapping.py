import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import app
from report_upload import HUMAN_ERRORS
from services.analysis_schema import GeminiServiceError
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


def _analyze_file(client, monkeypatch, side_effect):
    async def fake_analyze_report_files(files, source_ids=None):
        if isinstance(side_effect, Exception):
            raise side_effect
        return _analysis()

    monkeypatch.setattr(main_module, "analyze_report_files", fake_analyze_report_files)
    return client.post(
        "/api/analyze",
        files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
    )


@pytest.mark.parametrize(
    "code,status,key",
    [
        ("quota", 429, "quota"),
        ("timeout", 504, "timeout"),
        ("invalid_response", 502, "invalid_response"),
        ("empty_response", 502, "empty_response"),
        ("upstream", 502, "upstream"),
        ("auth", 502, "auth"),
        ("not_configured", 503, "not_configured"),
    ],
)
def test_analyze_error_codes_map_to_status_and_message(client, monkeypatch, code, status, key):
    response = _analyze_file(client, monkeypatch, GeminiServiceError(code))
    assert response.status_code == status
    assert response.json()["detail"] == HUMAN_ERRORS[key]


def test_analyze_unexpected_failure_is_generic_and_safe(client, monkeypatch):
    response = _analyze_file(client, monkeypatch, RuntimeError("db connection string"))
    assert response.status_code == 500
    assert response.json()["detail"] == HUMAN_ERRORS["processing"]
    assert "db connection string" not in response.json()["detail"]


def _chat(client, monkeypatch, body, side_effect=None):
    async def fake_answer(report_context, history, user_message):
        if isinstance(side_effect, Exception):
            raise side_effect
        return "Fixture answer"

    monkeypatch.setattr(main_module, "answer_report_question", fake_answer)
    return client.post("/api/chat", json=body)


def _chat_body(**overrides):
    body = {"analysis_id": seal_analysis(_analysis()), "message": "Hi", "messages": []}
    body.update(overrides)
    return body


@pytest.mark.parametrize(
    "code,status,key",
    [
        ("timeout", 504, "chat_timeout"),
        ("invalid_response", 502, "chat_invalid"),
        ("empty_response", 502, "chat_invalid"),
        ("upstream", 502, "chat_upstream"),
        ("auth", 502, "auth"),
        ("not_configured", 503, "not_configured"),
    ],
)
def test_chat_error_codes_map_to_status_and_message(client, monkeypatch, code, status, key):
    response = _chat(client, monkeypatch, _chat_body(), GeminiServiceError(code))
    assert response.status_code == status
    assert response.json()["detail"] == HUMAN_ERRORS[key]


def test_chat_unexpected_failure_is_generic_and_safe(client, monkeypatch):
    response = _chat(client, monkeypatch, _chat_body(), RuntimeError("secret-token-123"))
    assert response.status_code == 500
    assert response.json()["detail"] == HUMAN_ERRORS["chat_upstream"]
    assert "secret-token-123" not in response.json()["detail"]


@pytest.mark.parametrize(
    "key,expected",
    [
        ("too_large", "10 MB or smaller"),
        ("too_many_files", "Remove some files"),
        ("total_too_large", "Remove some files"),
        ("unsupported", "convert"),
        ("not_image", "re-exporting"),
        ("invalid_response", "clearer file"),
        ("rate_limited", "wait a moment"),
        ("quota", "wait a minute"),
        ("timeout", "try again"),
        ("upstream", "try again"),
        ("processing", "try again"),
        ("chat_expired", "analyze your reports again"),
        ("chat_context", "Analyze a report"),
        ("chat_upstream", "try again"),
        ("chat_timeout", "try again"),
        ("chat_invalid", "try again"),
        ("no_files", "Choose at least one"),
        ("empty", "upload"),
        ("malformed", "try again"),
        ("auth", "try again later"),
        ("not_configured", "not configured"),
        ("chat_empty", "Type a question"),
    ],
)
def test_error_messages_tell_the_user_what_to_do_next(key, expected):
    assert expected in HUMAN_ERRORS[key]


def test_error_messages_leak_no_internals():
    forbidden = ("api_key", "API_KEY", "Bearer", "Traceback", "Traceback (most recent", "sk-")
    for key, message in HUMAN_ERRORS.items():
        for token in forbidden:
            assert token not in message, f"{key} leaks internals"


def test_error_messages_make_no_medical_claims():
    lowered = " ".join(HUMAN_ERRORS.values()).lower()
    for phrase in ("diagnos", "treatment", "prescrib", "normal", "healthy", "disease"):
        assert phrase not in lowered
