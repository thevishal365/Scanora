import asyncio
import os
from pathlib import Path

import pytest

from env_loader import load_scanora_env
from services.gemini_service import analyze_report_files

pytestmark = pytest.mark.integration

FIXTURE_PDF = Path(__file__).parent / "fixtures" / "sample.pdf"


def _is_configured() -> bool:
    load_scanora_env()
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    model = (os.getenv("GEMINI_MODEL") or "").strip()
    return bool(api_key and model)


@pytest.mark.skipif(
    not _is_configured(),
    reason="GEMINI_API_KEY / GEMINI_MODEL not set",
)
def test_gemini_analyzes_pdf_end_to_end():
    data = FIXTURE_PDF.read_bytes()
    assert data.startswith(b"%PDF-")

    result = asyncio.run(analyze_report_files([(data, "application/pdf")]))

    assert isinstance(result["overall_summary"], str)
    assert result["overall_summary"].strip()
    assert isinstance(result["reports"], list)
    assert len(result["reports"]) > 0