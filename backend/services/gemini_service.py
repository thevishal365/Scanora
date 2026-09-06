import asyncio
import json
import logging
import os
import random
import re

from google import genai
from google.genai import types

from env_loader import load_scanora_env
from services.analysis_schema import (
    AnalysisResult,
    ChatAnswer,
    CHAT_SYSTEM_INSTRUCTION,
    GeminiServiceError,
    SYSTEM_INSTRUCTION,
    USER_INSTRUCTION,
    parse_model_json,
    validate_analysis_payload,
)

logger = logging.getLogger("scanora.gemini")
REQUEST_TIMEOUT_MS = 120_000

# Retry configuration for transient errors (e.g. 503 UNAVAILABLE / high demand)
MAX_RETRIES = 3  # Up to 4 total attempts
BASE_RETRY_DELAY = 1.0  # Initial delay in seconds
MAX_RETRY_DELAY = 8.0  # Maximum delay in seconds
RETRY_JITTER_MAX = 0.5  # Random jitter in seconds


def _sanitize_error_text(text: str, api_key: str) -> str:
    cleaned = str(text)
    if api_key:
        cleaned = cleaned.replace(api_key, "[redacted]")
    cleaned = re.sub(r"key=[^&\s]+", "key=[redacted]", cleaned, flags=re.I)
    return cleaned[:500]


def _settings():
    load_scanora_env()
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    model = (os.getenv("GEMINI_MODEL") or "").strip()
    if not api_key or not model:
        raise GeminiServiceError("not_configured")
    return api_key, model


def _is_transient_error(error: Exception) -> bool:
    """Determine whether an error from Gemini is transient and eligible for retry."""
    code = getattr(error, "code", None)
    status = str(getattr(error, "status", None) or "").upper()
    message = str(getattr(error, "message", None) or error).lower()

    # 503 / UNAVAILABLE / high demand, 500 / INTERNAL, 504 / DEADLINE_EXCEEDED, 502 / BAD_GATEWAY
    if code in (503, 500, 502, 504):
        return True
    if status in {"UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"}:
        return True
    if "high demand" in message or "unavailable" in message or "temporarily overloaded" in message:
        return True
    return False


def _humanize_genai_error(error: Exception, api_key: str) -> GeminiServiceError:
    code = getattr(error, "code", None)
    status = getattr(error, "status", None)
    message = _sanitize_error_text(getattr(error, "message", None) or error, api_key)
    logger.error(
        "Gemini request failed type=%s http_code=%s status=%s message=%s",
        type(error).__name__,
        code,
        status,
        message,
    )
    lowered = message.lower()
    if code in (401, 403) or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
        return GeminiServiceError("auth")
    if code == 429 or status == "RESOURCE_EXHAUSTED" or "quota" in lowered:
        return GeminiServiceError("quota")
    if code == 404 or status == "NOT_FOUND" or "no longer available" in lowered:
        return GeminiServiceError("upstream")
    if "timeout" in lowered or "timed out" in lowered:
        return GeminiServiceError("timeout")
    if any(token in lowered for token in ("api key", "api_key", "permission", "unauth")):
        return GeminiServiceError("auth")
    return GeminiServiceError("upstream")


async def analyze_report_images(images: list[tuple[bytes, str]]) -> dict:
    if not images:
        raise GeminiServiceError("empty_response")

    api_key, model = _settings()

    parts = [types.Part.from_text(text=USER_INSTRUCTION)]
    for content, mime_type in images:
        parts.append(types.Part.from_bytes(data=content, mime_type=mime_type))

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )

    response = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=parts,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=AnalysisResult,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                ),
            )
            break
        except GeminiServiceError:
            raise
        except Exception as error:
            if _is_transient_error(error) and attempt < MAX_RETRIES:
                delay = min(MAX_RETRY_DELAY, BASE_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, RETRY_JITTER_MAX)
                logger.warning(
                    "Gemini transient error on analyze (attempt %d/%d): %s. Retrying in %.2fs...",
                    attempt + 1,
                    MAX_RETRIES + 1,
                    _sanitize_error_text(getattr(error, "message", None) or error, api_key),
                    delay,
                )
                await asyncio.sleep(delay)
                continue
            logger.error(
                "Gemini analyze failed on attempt %d/%d (retries exhausted or non-retryable)",
                attempt + 1,
                MAX_RETRIES + 1,
            )
            raise _humanize_genai_error(error, api_key) from None

    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if hasattr(parsed, "model_dump"):
            return validate_analysis_payload(parsed.model_dump())
        if isinstance(parsed, dict):
            return validate_analysis_payload(parsed)

    return parse_model_json(getattr(response, "text", None))


CHAT_GUIDE = """The JSON below is the report context for this session. It comes from the user's currently uploaded reports.

Answer only from that context and the conversation.

Rules:
- Explain terms, values, and findings that appear in the context.
- If a value or range is not in the context, say you cannot determine that from the uploaded report. Do not guess.
- Do not invent values, units, reference ranges, or patient details.
- Do not diagnose, claim diagnostic certainty, prescribe medication, or recommend starting, stopping, or changing treatment.
- Do not pretend to be a doctor.
- Do not introduce new abnormal findings that are not supported by the context.
- Do not use external reference ranges to classify values.
- You may compare reports only using information actually present. If comparison is not possible, say so.
- If asked for a diagnosis, explain that you cannot determine a diagnosis from the report alone and that the user can discuss findings with a qualified healthcare professional.
"""


def _chat_client(api_key: str):
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )


async def answer_report_question(
    report_context: dict,
    history: list[dict],
    user_message: str,
) -> str:
    api_key, model = _settings()

    context_text = json.dumps(report_context, ensure_ascii=True)
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"{CHAT_GUIDE}\n\n{context_text}")],
        ),
        types.Content(
            role="model",
            parts=[
                types.Part.from_text(
                    text="I will only explain information from this report context and will not diagnose or invent values."
                )
            ],
        ),
    ]

    for item in history:
        role = "user" if item.get("role") == "user" else "model"
        text = str(item.get("content") or "").strip()
        if not text:
            continue
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=text)])
        )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )
    )

    client = _chat_client(api_key)

    response = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=CHAT_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=ChatAnswer,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                ),
            )
            break
        except GeminiServiceError:
            raise
        except Exception as error:
            if _is_transient_error(error) and attempt < MAX_RETRIES:
                delay = min(MAX_RETRY_DELAY, BASE_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, RETRY_JITTER_MAX)
                logger.warning(
                    "Gemini transient error on chat (attempt %d/%d): %s. Retrying in %.2fs...",
                    attempt + 1,
                    MAX_RETRIES + 1,
                    _sanitize_error_text(getattr(error, "message", None) or error, api_key),
                    delay,
                )
                await asyncio.sleep(delay)
                continue
            logger.error(
                "Gemini chat failed on attempt %d/%d (retries exhausted or non-retryable)",
                attempt + 1,
                MAX_RETRIES + 1,
            )
            raise _humanize_genai_error(error, api_key) from None

    parsed = getattr(response, "parsed", None)
    if parsed is not None and hasattr(parsed, "answer"):
        answer = str(parsed.answer or "").strip()
        if answer:
            return answer

    if parsed is not None and isinstance(parsed, dict):
        answer = str(parsed.get("answer") or "").strip()
        if answer:
            return answer

    raw = getattr(response, "text", None)
    if not raw or not str(raw).strip():
        raise GeminiServiceError("empty_response")

    try:
        payload = json.loads(str(raw).strip())
    except json.JSONDecodeError:
        text = str(raw).strip()
        if text:
            return text
        raise GeminiServiceError("invalid_response") from None

    answer = str(payload.get("answer") or "").strip()
    if not answer:
        raise GeminiServiceError("invalid_response")
    return answer
