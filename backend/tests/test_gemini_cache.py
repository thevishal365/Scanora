import asyncio
from types import SimpleNamespace

from services import gemini_service


def test_identical_analysis_uses_cache_and_returns_isolated_results(monkeypatch):
    calls = []

    class FakeModel:
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                parsed={
                    "overall_summary": "Fixture summary",
                    "reports": [
                        {
                            "source_id": "source-1",
                            "report_name": "CBC",
                            "summary": "Summary",
                            "key_findings": [],
                            "important_values": [],
                            "simple_explanation": "Explanation",
                        }
                    ],
                }
            )

    monkeypatch.setattr(
        gemini_service.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(
            aio=SimpleNamespace(models=FakeModel()),
        ),
    )
    monkeypatch.setattr(
        gemini_service, "_settings", lambda: ("test-api-key", "test-model")
    )

    async def invoke():
        files = [(b"%PDF-report-content", "application/pdf")]
        first = await gemini_service.analyze_report_files(files, ["source-1"])
        first["reports"][0]["summary"] = "Caller mutation"
        second = await gemini_service.analyze_report_files(files, ["source-1"])
        return second

    result = asyncio.run(invoke())

    assert len(calls) == 1
    assert result["reports"][0]["summary"] == "Summary"


def test_different_file_content_does_not_reuse_analysis_cache(monkeypatch):
    calls = []

    class FakeModel:
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                parsed={
                    "overall_summary": f"Summary {len(calls)}",
                    "reports": [
                        {
                            "source_id": "source-1",
                            "report_name": "CBC",
                            "summary": "Summary",
                            "key_findings": [],
                            "important_values": [],
                            "simple_explanation": "Explanation",
                        }
                    ],
                }
            )

    monkeypatch.setattr(
        gemini_service.genai,
        "Client",
        lambda **kwargs: SimpleNamespace(
            aio=SimpleNamespace(models=FakeModel()),
        ),
    )
    monkeypatch.setattr(
        gemini_service, "_settings", lambda: ("test-api-key", "test-model")
    )

    async def invoke():
        await gemini_service.analyze_report_files([(b"first", "image/png")])
        await gemini_service.analyze_report_files([(b"second", "image/png")])

    asyncio.run(invoke())

    assert len(calls) == 2
