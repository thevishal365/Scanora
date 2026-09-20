import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import app
from report_upload import HUMAN_ERRORS, MAX_FILES, MAX_TOTAL_BYTES

PNG_PREFIX = b"\x89PNG\r\n\x1a\n"


def _png_of_size(size: int) -> bytes:
    assert size >= len(PNG_PREFIX)
    return PNG_PREFIX + b"\x00" * (size - len(PNG_PREFIX))


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def patched_analyze(monkeypatch):
    calls = []

    async def fake_analyze_report_files(files, source_ids=None):
        calls.append(files)
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

    monkeypatch.setattr(main_module, "analyze_report_files", fake_analyze_report_files)
    return calls


def test_exactly_max_files_accepted(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[
            ("files", (f"page{i}.png", PNG_PREFIX + b"body", "image/png"))
            for i in range(MAX_FILES)
        ],
    )
    assert response.status_code == 200
    assert len(patched_analyze) == 1
    assert len(patched_analyze[0]) == MAX_FILES


def test_over_max_files_rejected_before_processing(client, patched_analyze):
    # Every file is also content-invalid; the count cap must win so the
    # request is rejected before any per-file processing or Gemini call.
    response = client.post(
        "/api/analyze",
        files=[
            ("files", (f"bad{i}.png", b"definitely not an image", "image/png"))
            for i in range(MAX_FILES + 1)
        ],
    )
    assert response.status_code == 413
    assert response.json()["detail"] == HUMAN_ERRORS["too_many_files"]
    assert patched_analyze == []


def test_exact_total_bytes_accepted(client, patched_analyze):
    # 3 x 10 MB valid PNGs == exactly MAX_TOTAL_BYTES (each within per-file).
    per_file = MAX_TOTAL_BYTES // 3
    assert per_file * 3 == MAX_TOTAL_BYTES
    response = client.post(
        "/api/analyze",
        files=[
            ("files", (f"big{i}.png", _png_of_size(per_file), "image/png"))
            for i in range(3)
        ],
    )
    assert response.status_code == 200
    assert len(patched_analyze) == 1
    assert len(patched_analyze[0]) == 3


def test_over_total_bytes_rejected_before_gemini(client, patched_analyze):
    # Total is MAX_TOTAL_BYTES + 1 while every file stays within per-file.
    per_file = MAX_TOTAL_BYTES // 3
    sizes = [per_file - 8, per_file, per_file, 9]
    assert sum(sizes) == MAX_TOTAL_BYTES + 1
    assert all(size <= 10 * 1024 * 1024 for size in sizes)
    response = client.post(
        "/api/analyze",
        files=[
            ("files", (f"big{i}.png", _png_of_size(size), "image/png"))
            for i, size in enumerate(sizes)
        ],
    )
    assert response.status_code == 413
    assert response.json()["detail"] == HUMAN_ERRORS["total_too_large"]
    assert patched_analyze == []
