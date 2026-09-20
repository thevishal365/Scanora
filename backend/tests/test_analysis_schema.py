import pytest

from services.analysis_schema import (
    MISSING_FIELD_LABEL,
    GeminiServiceError,
    parse_model_json,
    validate_analysis_payload,
)


def _payload(**value_overrides):
    value = {
        "name": "Hemoglobin",
        "value": "13.2",
        "unit": "g/dL",
        "reference_range": "12.0 - 16.0",
    }
    value.update(value_overrides)
    return {
        "overall_summary": "Summary",
        "reports": [
            {
                "source_id": "source-1",
                "report_name": "CBC",
                "summary": "Summary",
                "key_findings": ["Finding"],
                "important_values": [value],
                "simple_explanation": "Explanation",
            }
        ],
    }


def _single_value(payload):
    return payload["reports"][0]["important_values"][0]


def test_null_unit_degrades_gracefully():
    cleaned = validate_analysis_payload(_payload(unit=None))
    assert _single_value(cleaned)["unit"] == MISSING_FIELD_LABEL


def test_missing_unit_key_degrades_gracefully():
    payload = _payload()
    del payload["reports"][0]["important_values"][0]["unit"]
    cleaned = validate_analysis_payload(payload)
    assert _single_value(cleaned)["unit"] == MISSING_FIELD_LABEL


def test_null_reference_range_degrades_gracefully():
    cleaned = validate_analysis_payload(_payload(reference_range=None))
    assert _single_value(cleaned)["reference_range"] == MISSING_FIELD_LABEL


def test_missing_reference_range_key_degrades_gracefully():
    payload = _payload()
    del payload["reports"][0]["important_values"][0]["reference_range"]
    cleaned = validate_analysis_payload(payload)
    assert _single_value(cleaned)["reference_range"] == MISSING_FIELD_LABEL


def test_blank_unit_and_range_degrade_gracefully():
    cleaned = validate_analysis_payload(_payload(unit="   ", reference_range=""))
    value = _single_value(cleaned)
    assert value["unit"] == MISSING_FIELD_LABEL
    assert value["reference_range"] == MISSING_FIELD_LABEL


def test_unclear_labels_are_preserved_not_overwritten():
    cleaned = validate_analysis_payload(
        _payload(unit="Unclear", reference_range="Unclear")
    )
    value = _single_value(cleaned)
    assert value["unit"] == "Unclear"
    assert value["reference_range"] == "Unclear"


def test_provided_unit_and_range_pass_through_verbatim():
    cleaned = validate_analysis_payload(
        _payload(unit="mg/dL", reference_range="70 - 100")
    )
    value = _single_value(cleaned)
    assert value["unit"] == "mg/dL"
    assert value["reference_range"] == "70 - 100"


def test_missing_name_still_fails():
    payload = _payload()
    del payload["reports"][0]["important_values"][0]["name"]
    with pytest.raises(GeminiServiceError):
        validate_analysis_payload(payload)


def test_null_value_still_fails():
    with pytest.raises(GeminiServiceError):
        validate_analysis_payload(_payload(value=None))


def test_non_dict_value_entry_still_fails():
    payload = _payload()
    payload["reports"][0]["important_values"] = ["not-a-dict"]
    with pytest.raises(GeminiServiceError):
        validate_analysis_payload(payload)


def test_model_json_with_null_range_parses():
    raw = (
        '{"overall_summary": "Summary", "reports": [{'
        '"source_id": "source-1", "report_name": "CBC", "summary": "Summary", '
        '"key_findings": [], "important_values": [{'
        '"name": "Protein", "value": "Trace", '
        '"unit": null, "reference_range": null}], '
        '"simple_explanation": "Explanation"}]}'
    )
    cleaned = parse_model_json(raw)
    value = _single_value(cleaned)
    assert value["unit"] == MISSING_FIELD_LABEL
    assert value["reference_range"] == MISSING_FIELD_LABEL
    # Identity of the finding itself is preserved, not fabricated.
    assert value["name"] == "Protein"
    assert value["value"] == "Trace"
