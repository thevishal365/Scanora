import asyncio
from types import SimpleNamespace

import pytest

from services import gemini_service
from services.analysis_schema import GeminiServiceError


class ProviderError(Exception):
    def __init__(self, code, status, message):
        self.code = code
        self.status = status
        self.message = message
        super().__init__(message)


@pytest.mark.parametrize(
    "code,status,message,expected",
    [
        (503, "UNAVAILABLE", "high demand", "unavailable"),
        (429, "RESOURCE_EXHAUSTED", "quota exceeded", "quota"),
        (401, "UNAUTHENTICATED", "invalid API key", "auth"),
        (400, "INVALID_ARGUMENT", "malformed request", "malformed_request"),
    ],
)
def test_provider_errors_keep_distinct_error_codes(
    code, status, message, expected
):
    error = ProviderError(code, status, message)

    mapped = gemini_service._humanize_genai_error(error, "test-api-key")

    assert mapped.code == expected
    assert gemini_service._is_transient_error(error) is (expected == "unavailable")


@pytest.mark.parametrize("operation", ["analysis", "chat"])
def test_transient_provider_error_makes_at_most_four_requests_with_backoff(
    monkeypatch, operation
):
    error = ProviderError(503, "UNAVAILABLE", "high demand")
    calls = []
    sleeps = []

    class FakeModel:
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            raise error

    fake_client = SimpleNamespace(
        aio=SimpleNamespace(models=FakeModel()),
    )
    monkeypatch.setattr(gemini_service.genai, "Client", lambda **kwargs: fake_client)
    monkeypatch.setattr(
        gemini_service,
        "_settings",
        lambda: ("test-api-key", "test-model"),
    )

    async def record_sleep(delay):
        sleeps.append(delay)

    monkeypatch.setattr(gemini_service.asyncio, "sleep", record_sleep)

    async def invoke():
        if operation == "analysis":
            await gemini_service.analyze_report_files([(b"mock report", "image/png")])
        else:
            await gemini_service.answer_report_question({}, [], "What does this mean?")

    with pytest.raises(GeminiServiceError) as raised:
        asyncio.run(invoke())

    assert raised.value.code == "unavailable"
    assert len(calls) == 4
    # Exponential backoff: 1s, 2s, 4s base delays, plus 0–0.5s jitter each.
    assert sleeps[0] >= 1.0 and sleeps[0] <= 1.5
    assert sleeps[1] >= 2.0 and sleeps[1] <= 2.5
    assert sleeps[2] >= 4.0 and sleeps[2] <= 4.5
