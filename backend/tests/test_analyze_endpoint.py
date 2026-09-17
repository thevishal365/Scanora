from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import app

FIXTURE_PDF = (Path(__file__).parent / "fixtures" / "sample.pdf").read_bytes()
MAX_FILE_BYTES = 10 * 1024 * 1024

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png-body"
JPEG_BYTES = b"\xff\xd8\xff" + b"jpeg-body"
PDF_BYTES = FIXTURE_PDF
TEXT_BYTES = b"hello world, definitely not a pdf"


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def patched_analyze(monkeypatch):
    calls = []

    async def fake_analyze_report_files(files):
        calls.append(files)
        return {
            "overall_summary": "Fixture summary",
            "reports": [
                {
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


def test_valid_png(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[("files", ("cbc.png", PNG_BYTES, "image/png"))],
    )
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert len(patched_analyze) == 1
    assert len(patched_analyze[0]) == 1


def test_valid_pdf(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[("files", ("report.pdf", PDF_BYTES, "application/pdf"))],
    )
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert len(patched_analyze[0]) == 1
    assert patched_analyze[0][0] == (PDF_BYTES, "application/pdf")


def test_mixed_jpg_png_pdf_in_one_request(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[
            ("files", ("a.jpg", JPEG_BYTES, "image/jpeg")),
            ("files", ("b.png", PNG_BYTES, "image/png")),
            ("files", ("c.pdf", PDF_BYTES, "application/pdf")),
        ],
    )
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert len(patched_analyze[0]) == 3


def test_renamed_pdf_is_rejected(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[("files", ("fake.pdf", TEXT_BYTES, "application/pdf"))],
    )
    assert response.status_code == 400
    assert "not a valid" in response.json()["detail"]
    assert patched_analyze == []


def test_docx_is_rejected(client, patched_analyze):
    response = client.post(
        "/api/analyze",
        files=[
            (
                "files",
                ("notes.docx", b"fake", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            )
        ],
    )
    assert response.status_code == 400
    assert "Word documents are not supported" in response.json()["detail"]
    assert patched_analyze == []


def test_exact_10mb_pdf_is_accepted(client, patched_analyze):
    payload = PDF_BYTES + b"\x00" * (MAX_FILE_BYTES - len(PDF_BYTES))
    assert len(payload) == MAX_FILE_BYTES
    response = client.post(
        "/api/analyze",
        files=[("files", ("big.pdf", payload, "application/pdf"))],
    )
    assert response.status_code == 200
    assert len(patched_analyze[0]) == 1


def test_over_10mb_png_is_rejected(client, patched_analyze):
    payload = PNG_BYTES + b"\x00" * (MAX_FILE_BYTES - len(PNG_BYTES) + 1)
    assert len(payload) == MAX_FILE_BYTES + 1
    response = client.post(
        "/api/analyze",
        files=[("files", ("huge.png", payload, "image/png"))],
    )
    assert response.status_code == 413
    assert "10 MB or smaller" in response.json()["detail"]
    assert patched_analyze == []


def test_over_10mb_pdf_is_rejected(client, patched_analyze):
    payload = PDF_BYTES + b"\x00" * (MAX_FILE_BYTES - len(PDF_BYTES) + 1)
    assert len(payload) == MAX_FILE_BYTES + 1
    response = client.post(
        "/api/analyze",
        files=[("files", ("huge.pdf", payload, "application/pdf"))],
    )
    assert response.status_code == 413
    assert "10 MB or smaller" in response.json()["detail"]
    assert patched_analyze == []


def test_no_files_is_rejected(client, patched_analyze):
    response = client.post("/api/analyze")
    assert response.status_code == 400
    assert patched_analyze == []