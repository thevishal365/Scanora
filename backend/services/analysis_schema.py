import json
import re

from pydantic import BaseModel


class ImportantValue(BaseModel):
    name: str
    value: str
    unit: str
    reference_range: str


class ReportAnalysis(BaseModel):
    report_name: str
    summary: str
    key_findings: list[str]
    important_values: list[ImportantValue]
    simple_explanation: str


class AnalysisResult(BaseModel):
    overall_summary: str
    reports: list[ReportAnalysis]


class ChatAnswer(BaseModel):
    answer: str


CHAT_SYSTEM_INSTRUCTION = (
    "You are an AI assistant for understanding uploaded medical reports. "
    "Only use information in the provided report context. "
    "Do not diagnose, prescribe treatment, or invent information. "
    "Clearly state when the report does not contain enough information."
)


SYSTEM_INSTRUCTION = (
    "You are an AI assistant for understanding medical reports. "
    "Only use information visible in the provided reports. "
    "Do not diagnose, prescribe treatment, or invent information. "
    "Clearly state when information is unreadable, missing, or cannot be determined from the reports."
)

USER_INSTRUCTION = """These images belong to the same analysis request. Look at the report images directly.

Return JSON only, using this structure:
{
  "overall_summary": "A simple summary of the uploaded reports.",
  "reports": [
    {
      "report_name": "Name/type of report if clearly identifiable",
      "summary": "Short summary of this report",
      "key_findings": ["Finding 1", "Finding 2"],
      "important_values": [
        {
          "name": "Test name",
          "value": "Value",
          "unit": "Unit if shown",
          "reference_range": "Reference range if shown"
        }
      ],
      "simple_explanation": "Explain this report in easy language."
    }
  ]
}

Rules:
- Use only information that is actually visible in the images.
- Never invent test values, units, reference ranges, diagnoses, symptoms, medications, patient details, or findings.
- Do not diagnose disease, claim diagnostic certainty, prescribe medication, or recommend treatment or medication changes.
- Do not claim to replace a doctor.
- If text is unreadable, say it is unclear.
- If something is missing, do not guess.
- If image quality is too poor to read reliably, say so.
- Explain medical terms in simple language.
- You may suggest discussing unclear or concerning findings with a qualified healthcare professional, without giving treatment advice.
- If a field is not shown, use "Not shown" or "Unclear" instead of making up a value.
"""


class GeminiServiceError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _as_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    return None


def _as_string_list(value) -> list[str] | None:
    if not isinstance(value, list):
        return None
    items = []
    for item in value:
        text = _as_text(item)
        if text is None:
            return None
        items.append(text)
    return items


def validate_analysis_payload(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise GeminiServiceError("invalid_response")

    overall_summary = _as_text(payload.get("overall_summary"))
    reports = payload.get("reports")

    if overall_summary is None or not overall_summary.strip():
        raise GeminiServiceError("invalid_response")

    if not isinstance(reports, list):
        raise GeminiServiceError("invalid_response")

    cleaned_reports = []
    for report in reports:
        if not isinstance(report, dict):
            raise GeminiServiceError("invalid_response")

        report_name = _as_text(report.get("report_name"))
        summary = _as_text(report.get("summary"))
        simple_explanation = _as_text(report.get("simple_explanation"))
        key_findings = _as_string_list(report.get("key_findings"))
        important_values = report.get("important_values")

        if (
            report_name is None
            or summary is None
            or simple_explanation is None
            or key_findings is None
            or not isinstance(important_values, list)
        ):
            raise GeminiServiceError("invalid_response")

        cleaned_values = []
        for item in important_values:
            if not isinstance(item, dict):
                raise GeminiServiceError("invalid_response")
            name = _as_text(item.get("name"))
            value = _as_text(item.get("value"))
            unit = _as_text(item.get("unit"))
            reference_range = _as_text(item.get("reference_range"))
            if None in (name, value, unit, reference_range):
                raise GeminiServiceError("invalid_response")
            cleaned_values.append(
                {
                    "name": name,
                    "value": value,
                    "unit": unit,
                    "reference_range": reference_range,
                }
            )

        cleaned_reports.append(
            {
                "report_name": report_name,
                "summary": summary,
                "key_findings": key_findings,
                "important_values": cleaned_values,
                "simple_explanation": simple_explanation,
            }
        )

    return {
        "overall_summary": overall_summary,
        "reports": cleaned_reports,
    }


def parse_model_json(text: str | None) -> dict:
    if not text or not text.strip():
        raise GeminiServiceError("empty_response")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, count=1)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        raise GeminiServiceError("invalid_response") from None

    return validate_analysis_payload(payload)
