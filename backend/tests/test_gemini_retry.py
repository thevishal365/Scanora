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
def test_transient_provider_error_makes_at_most_two_requests(
    monkeypatch, operation
):
    error = ProviderError(503, "UNAVAILABLE", "high demand")
    calls = []

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

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(gemini_service.asyncio, "sleep", no_sleep)

    async def invoke():
        if operation == "analysis":
            await gemini_service.analyze_report_files([(b"mock report", "image/png")])
        else:
            await gemini_service.answer_report_question({}, [], "What does this mean?")

    with pytest.raises(GeminiServiceError) as raised:
        asyncio.run(invoke())

    assert raised.value.code == "unavailable"
    assert len(calls) == 2
