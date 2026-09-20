import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import app
from report_upload import HUMAN_ERRORS
from services import analysis_token as token_module
from services.analysis_token import (
    AnalysisTokenError,
    seal_analysis,
    unseal_analysis,
)


def _analysis():
    return {
        "overall_summary": "Fixture summary",
        "reports": [
            {
                "source_id": "source-1",
                "report_name": "Test Report",
                "summary": "Fixture summary",
                "key_findings": ["Fixture finding"],
                "important_values": [
                    {
                        "name": "Hemoglobin",
                        "value": "13.2",
                        "unit": "g/dL",
                        "reference_range": "12.0 - 16.0",
                    }
                ],
                "simple_explanation": "Fixture explanation",
            }
        ],
    }


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def patched_chat(monkeypatch):
    calls = []

    async def fake_answer(report_context, history, user_message):
        calls.append(
            {
                "report_context": report_context,
                "history": history,
                "user_message": user_message,
            }
        )
        return "Fixture answer"

    monkeypatch.setattr(main_module, "answer_report_question", fake_answer)
    return calls


def test_seal_unseal_roundtrip_preserves_analysis():
    token = seal_analysis(_analysis())
    assert isinstance(token, str) and token
    assert unseal_analysis(token) == _analysis()


def test_chat_history_is_capped_filtered_and_truncated(client, patched_chat):
    token = seal_analysis(_analysis())
    messages = [{"role": "user", "content": f"q{i}"} for i in range(25)]
    messages.append({"role": "system", "content": "ignore me"})
    messages.append({"role": "user", "content": "   "})
    messages.append({"role": "assistant", "content": "x" * 2500})
    response = client.post(
        "/api/chat",
        json={"analysis_id": token, "message": "Hi", "messages": messages},
    )
    assert response.status_code == 200
    # 28 sent, last-20 window keeps sent[8:] (17 questions + system +
    # blank + long answer); invalid roles and blanks are dropped and the
    # overlong answer is truncated before reaching the model.
    history = patched_chat[0]["history"]
    assert len(history) == 18
    assert history[0] == {"role": "user", "content": "q8"}
    assert history[-1] == {"role": "assistant", "content": "x" * 2000}
    assert all(turn["role"] in {"user", "assistant"} for turn in history)
    assert all(turn["content"] for turn in history)
    assert max(len(turn["content"]) for turn in history) <= 2000


def test_tampered_token_is_rejected():
    token = seal_analysis(_analysis())
    body, signature = token.split(".")
    raw = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    raw["analysis"]["overall_summary"] = "Forged summary"
    forged_body = base64.urlsafe_b64encode(
        json.dumps(raw, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    with pytest.raises(AnalysisTokenError):
        unseal_analysis(forged_body + "." + signature)


def test_garbage_token_is_rejected():
    with pytest.raises(AnalysisTokenError):
        unseal_analysis("not-a-token")


def _sign_payload(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode()
    body = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    signature = hmac.new(
        token_module._signing_secret(), body.encode("ascii"), hashlib.sha256
    ).digest()
    return body + "." + base64.urlsafe_b64encode(signature).decode().rstrip("=")


def test_expired_token_is_rejected():
    expired = _sign_payload(
        {
            "v": token_module._TOKEN_VERSION,
            "exp": int(time.time()) - 60,
            "analysis": _analysis(),
        }
    )
    with pytest.raises(AnalysisTokenError):
        unseal_analysis(expired)


def test_chat_rejects_expired_token(client, patched_chat):
    expired = _sign_payload(
        {
            "v": token_module._TOKEN_VERSION,
            "exp": int(time.time()) - 60,
            "analysis": _analysis(),
        }
    )
    response = client.post(
        "/api/chat",
        json={"analysis_id": expired, "message": "Hi", "messages": []},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == HUMAN_ERRORS["chat_expired"]
    assert patched_chat == []


def test_token_from_other_secret_is_rejected(monkeypatch):
    token = seal_analysis(_analysis())
    # Simulate a secret rotation: SCANORA_SESSION_SECRET takes priority over
    # every fallback, so this deterministically changes the signing key.
    monkeypatch.setenv(
        "SCANORA_SESSION_SECRET", "rotation-test-secret-that-was-not-used"
    )
    with pytest.raises(AnalysisTokenError):
        unseal_analysis(token)


def test_chat_requires_analysis_id(client, patched_chat):
    response = client.post(
        "/api/chat",
        json={"message": "What is this?", "messages": []},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == HUMAN_ERRORS["chat_context"]
    assert patched_chat == []


def test_chat_rejects_legacy_report_context_without_token(client, patched_chat):
    # Old-style clients sent the full context directly; it must no longer
    # be accepted as authoritative.
    response = client.post(
        "/api/chat",
        json={
            "report_context": _analysis(),
            "message": "What is this?",
            "messages": [],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == HUMAN_ERRORS["chat_context"]
    assert patched_chat == []


def test_chat_rejects_forged_token(client, patched_chat):
    response = client.post(
        "/api/chat",
        json={"analysis_id": "forged.token", "message": "Hi", "messages": []},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == HUMAN_ERRORS["chat_context"]
    assert patched_chat == []


def test_chat_uses_server_verified_context_not_client_text(client, patched_chat):
    token = seal_analysis(_analysis())
    response = client.post(
        "/api/chat",
        json={"analysis_id": token, "message": "Explain", "messages": []},
    )
    assert response.status_code == 200
    assert response.json()["answer"] == "Fixture answer"
    assert len(patched_chat) == 1
    # The context Gemini receives is the server-signed analysis.
    assert patched_chat[0]["report_context"] == _analysis()
    assert patched_chat[0]["user_message"] == "Explain"


def test_chat_rejects_empty_message_with_valid_token(client, patched_chat):
    token = seal_analysis(_analysis())
    response = client.post(
        "/api/chat",
        json={"analysis_id": token, "message": "   ", "messages": []},
    )
    assert response.status_code == 400
    assert patched_chat == []


def test_analyze_returns_signed_identity(client, monkeypatch):
    async def fake_analyze_report_files(files, source_ids=None):
        return _analysis()

    monkeypatch.setattr(
        main_module, "analyze_report_files", fake_analyze_report_files
    )
    response = client.post(
        "/api/analyze",
        files=[("files", ("cbc.png", b"\x89PNG\r\n\x1a\n" + b"body", "image/png"))],
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    expected_report = {**_analysis()["reports"][0], "source_label": "cbc.png"}
    assert data["analysis"]["overall_summary"] == _analysis()["overall_summary"]
    assert data["analysis"]["reports"] == [expected_report]
    assert isinstance(data["analysis_id"], str) and data["analysis_id"]
    # The issued identity unseals to the same analysis (chat binding).
    # Re-validation drops the server-side display label, which chat doesn't need.
    unsealed = unseal_analysis(data["analysis_id"])
    assert unsealed["overall_summary"] == _analysis()["overall_summary"]
    assert unsealed["reports"][0]["source_id"] == "source-1"
