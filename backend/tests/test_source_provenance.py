import pytest
from fastapi.testclient import TestClient

import main as main_module
from main import app
from report_upload import (
    HUMAN_ERRORS,
    build_source_ids,
    safe_display_filename,
)
from services.analysis_schema import GeminiServiceError, validate_analysis_payload

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png-body"


def _report(source_id, name="Test Report"):
    report = {
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
    if source_id is not None:
        report["source_id"] = source_id
    if name is not None:
        report["report_name"] = name
    return report


def _payload(reports):
    return {"overall_summary": "Fixture summary", "reports": reports}


@pytest.fixture()
def client():
    return TestClient(app)


def test_source_ids_are_positional_and_distinct():
    ids = build_source_ids(2)
    assert ids == ["source-1", "source-2"]
    assert len(set(ids)) == len(ids)


def test_safe_display_filename_strips_paths_and_blanks():
    assert safe_display_filename("../../etc/passwd") == "passwd"
    assert safe_display_filename("..\\..\\secret.txt") == "secret.txt"
    assert safe_display_filename("") == "report"
    assert safe_display_filename(None) == "report"
    assert len(safe_display_filename("a" * 200 + ".png")) == 80


def test_two_files_receive_distinct_source_ids_end_to_end(client, monkeypatch):
    calls = []

    async def fake_analyze_report_files(files, source_ids=None):
        calls.append({"files": files, "source_ids": source_ids})
        # Same Gemini-generated name twice: provenance must not collapse.
        reports = [_report(sid, name="Same Name") for sid in source_ids]
        return validate_analysis_payload(_payload(reports), source_ids)

    monkeypatch.setattr(main_module, "analyze_report_files", fake_analyze_report_files)
    response = client.post(
        "/api/analyze",
        files=[
            # A filename that looks like an ID must not become the identity.
            ("files", ("source-9.png", PNG_BYTES, "image/png")),
            ("files", ("cbc.png", PNG_BYTES, "image/png")),
        ],
    )
    assert response.status_code == 200
    data = response.json()
    assert [report["source_id"] for report in data["analysis"]["reports"]] == [
        "source-1",
        "source-2",
    ]
    assert [report["report_name"] for report in data["analysis"]["reports"]] == [
        "Same Name",
        "Same Name",
    ]
    # Server-side display labels preserve the real filenames separately.
    assert [report["source_label"] for report in data["analysis"]["reports"]] == [
        "source-9.png",
        "cbc.png",
    ]
    # The service received positional IDs and raw (content, mime) parts only:
    # no filename ever travels as identity or to the model.
    assert calls[0]["source_ids"] == ["source-1", "source-2"]
    for content, mime_type in calls[0]["files"]:
        assert isinstance(content, bytes)
        assert mime_type == "image/png"
        assert b"source-9" not in content


def _bad_payload(kind, source_ids):
    if kind == "unknown":
        return _payload([_report("source-1"), _report("source-9")])
    if kind == "missing":
        return _payload([_report("source-1"), _report(None)])
    if kind == "blank":
        return _payload([_report("source-1"), _report("   ")])
    if kind == "duplicate":
        return _payload([_report("source-1"), _report("source-1")])
    if kind == "short":
        return _payload([_report("source-1")])
    if kind == "extra":
        return _payload(
            [_report("source-1"), _report("source-2"), _report("source-3")]
        )
    raise AssertionError(kind)


@pytest.mark.parametrize(
    "kind", ["unknown", "missing", "blank", "duplicate", "short", "extra"]
)
def test_bad_source_ids_fail_safely(client, monkeypatch, kind):
    async def fake_analyze_report_files(files, source_ids=None):
        # Mirror the real service: model output is validated before use.
        return validate_analysis_payload(_bad_payload(kind, source_ids), source_ids)

    monkeypatch.setattr(main_module, "analyze_report_files", fake_analyze_report_files)
    response = client.post(
        "/api/analyze",
        files=[
            ("files", ("a.png", PNG_BYTES, "image/png")),
            ("files", ("b.png", PNG_BYTES, "image/png")),
        ],
    )
    assert response.status_code == 502
    assert response.json()["detail"] == HUMAN_ERRORS["invalid_response"]


def test_exact_coverage_match_passes():
    cleaned = validate_analysis_payload(
        _payload([_report("source-2"), _report("source-1")]),
        ["source-1", "source-2"],
    )
    assert [report["source_id"] for report in cleaned["reports"]] == [
        "source-2",
        "source-1",
    ]


def test_presence_checked_without_expected_ids():
    # Re-validation path (e.g. sealed chat tokens): shape enforced,
    # coverage not re-checked.
    cleaned = validate_analysis_payload(_payload([_report("source-9")]))
    assert cleaned["reports"][0]["source_id"] == "source-9"
    with pytest.raises(GeminiServiceError):
        validate_analysis_payload(_payload([_report(None)]))
