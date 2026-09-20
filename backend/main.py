from env_loader import load_scanora_env

# Load C:\Project\Scanora\.env before Gemini settings are read.
load_scanora_env()

import time
from threading import Lock

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from report_upload import (
    ALLOWED_EXTENSIONS,
    HUMAN_ERRORS,
    MAX_FILE_BYTES,
    MAX_FILES,
    MAX_TOTAL_BYTES,
    READ_CHUNK_BYTES,
    build_source_ids,
    content_matches_type,
    extension_and_mime_agree,
    extension_error_message,
    file_extension,
    mime_for_extension,
    mime_is_allowed,
    safe_display_filename,
)
from services.analysis_schema import GeminiServiceError
from services.analysis_token import AnalysisTokenError, seal_analysis, unseal_analysis
from services.gemini_service import analyze_report_files, answer_report_question

app = FastAPI(title="Scanora")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://scanora-ai.netlify.app",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

GEMINI_ERROR_STATUS = {
    "not_configured": 503,
    "auth": 502,
    "timeout": 504,
    "invalid_response": 502,
    "empty_response": 502,
    "upstream": 502,
    "quota": 429,
}


# Minimal in-process rate limiting for the expensive Gemini endpoints.
# Fixed-window per-client-IP counters, stdlib only. This is sized for the
# current single-backend deployment. If backend replicas are ever added,
# enforce limits at the hosting/gateway layer (reverse-proxy rate limiting
# or a shared counter) instead of relying on this per-process store, which
# does not coordinate across processes.
RATE_LIMIT_ANALYZE = (10, 60.0)  # 10 requests per 60 seconds per IP
RATE_LIMIT_CHAT = (30, 60.0)  # 30 requests per 60 seconds per IP

_RATE_LIMIT_STORE: dict[tuple[str, str], list[float]] = {}
_RATE_LIMIT_LOCK = Lock()


def reset_rate_limits() -> None:
    """Clear all rate-limit counters (test hook)."""
    with _RATE_LIMIT_LOCK:
        _RATE_LIMIT_STORE.clear()


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def check_rate_limit(request: Request, endpoint: str, limit: int, window: float) -> None:
    now = time.monotonic()
    key = (endpoint, _client_ip(request))
    with _RATE_LIMIT_LOCK:
        if len(_RATE_LIMIT_STORE) > 20000:
            # Hygiene bound: drop expired buckets if the store ever grows large.
            for stored_key, stamps in list(_RATE_LIMIT_STORE.items()):
                fresh = [stamp for stamp in stamps if now - stamp < window]
                if fresh:
                    _RATE_LIMIT_STORE[stored_key] = fresh
                else:
                    del _RATE_LIMIT_STORE[stored_key]
        stamps = [
            stamp for stamp in _RATE_LIMIT_STORE.get(key, []) if now - stamp < window
        ]
        if len(stamps) >= limit:
            raise HTTPException(
                status_code=429,
                detail=HUMAN_ERRORS["rate_limited"],
                headers={"Retry-After": str(int(window))},
            )
        stamps.append(now)
        _RATE_LIMIT_STORE[key] = stamps


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"detail": HUMAN_ERRORS["malformed"]},
    )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "message": "Scanora backend is running",
    }


async def read_upload_capped(upload: UploadFile, filename: str = "file") -> bytes:
    chunks = []
    total = 0

    while True:
        chunk = await upload.read(READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"{filename}: {HUMAN_ERRORS['too_large']}",
            )
        chunks.append(chunk)

    return b"".join(chunks)


@app.post("/api/analyze")
async def analyze(request: Request, files: list[UploadFile] | None = File(default=None)):
    limit, window = RATE_LIMIT_ANALYZE
    check_rate_limit(request, "analyze", limit, window)

    if not files:
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["no_files"])

    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=413,
            detail=HUMAN_ERRORS["too_many_files"],
        )

    file_parts = []
    total_bytes = 0
    # Stable per-upload provenance identity, assigned before Gemini sees
    # anything. Filenames are kept only as sanitized display labels.
    source_ids = build_source_ids(len(files))
    source_labels = {}

    try:
        for index, upload in enumerate(files):
            filename = upload.filename or "uploaded file"

            extension = file_extension(upload.filename)
            mime_type = (upload.content_type or "").lower()

            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename}: {extension_error_message(filename)}",
                )

            if not mime_is_allowed(mime_type):
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename}: {HUMAN_ERRORS['unsupported']}",
                )

            if not extension_and_mime_agree(extension, mime_type):
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename}: {HUMAN_ERRORS['unsupported']}",
                )

            content = await read_upload_capped(upload, filename)

            if not content:
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename}: {HUMAN_ERRORS['empty']}",
                )

            if not content_matches_type(extension, content):
                raise HTTPException(
                    status_code=400,
                    detail=f"{filename}: {HUMAN_ERRORS['not_image']}",
                )

            total_bytes += len(content)
            if total_bytes > MAX_TOTAL_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=HUMAN_ERRORS["total_too_large"],
                )

            source_labels[source_ids[index]] = safe_display_filename(upload.filename)
            file_parts.append((content, mime_for_extension(extension)))

        analysis = await analyze_report_files(file_parts, source_ids)
        # Attach server-side display labels (never model-generated). Every
        # report passed validation, so each source_id is one we issued.
        analysis["reports"] = [
            {
                **report,
                "source_label": source_labels.get(report["source_id"], "report"),
            }
            for report in analysis["reports"]
        ]
    except HTTPException:
        raise
    except GeminiServiceError as error:
        raise HTTPException(
            status_code=GEMINI_ERROR_STATUS.get(error.code, 502),
            detail=HUMAN_ERRORS.get(error.code, HUMAN_ERRORS["upstream"]),
        ) from None
    except Exception:
        raise HTTPException(status_code=500, detail=HUMAN_ERRORS["processing"]) from None
    finally:
        for upload in files:
            await upload.close()

    return {
        "success": True,
        "analysis": analysis,
        "analysis_id": seal_analysis(analysis),
    }


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    analysis_id: str = ""
    messages: list[ChatTurn] = Field(default_factory=list)
    message: str


CHAT_ERROR_DETAIL = {
    "not_configured": HUMAN_ERRORS["not_configured"],
    "auth": HUMAN_ERRORS["auth"],
    "timeout": HUMAN_ERRORS["chat_timeout"],
    "invalid_response": HUMAN_ERRORS["chat_invalid"],
    "empty_response": HUMAN_ERRORS["chat_invalid"],
    "upstream": HUMAN_ERRORS["chat_upstream"],
}

MAX_CHAT_HISTORY = 20
MAX_CHAT_MESSAGE = 2000


@app.post("/api/chat")
async def chat(payload: ChatRequest, request: Request):
    limit, window = RATE_LIMIT_CHAT
    check_rate_limit(request, "chat", limit, window)

    user_message = (payload.message or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["chat_empty"])

    if len(user_message) > MAX_CHAT_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail="Please keep your question shorter so it can be answered clearly.",
        )

    if not isinstance(payload.analysis_id, str) or not payload.analysis_id.strip():
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["chat_context"])

    try:
        report_context = unseal_analysis(payload.analysis_id)
    except AnalysisTokenError as exc:
        # An expired identity means the user did analyze, but too long ago;
        # say so instead of implying they never analyzed.
        if "expired" in str(exc):
            raise HTTPException(
                status_code=400, detail=HUMAN_ERRORS["chat_expired"]
            ) from None
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["chat_context"]) from None

    history = []
    for turn in payload.messages[-MAX_CHAT_HISTORY:]:
        role = (turn.role or "").strip().lower()
        content = (turn.content or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        if len(content) > MAX_CHAT_MESSAGE:
            content = content[:MAX_CHAT_MESSAGE]
        history.append({"role": role, "content": content})

    try:
        answer = await answer_report_question(
            report_context,
            history,
            user_message,
        )
    except GeminiServiceError as error:
        raise HTTPException(
            status_code=GEMINI_ERROR_STATUS.get(error.code, 502),
            detail=CHAT_ERROR_DETAIL.get(error.code, HUMAN_ERRORS["chat_upstream"]),
        ) from None
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=HUMAN_ERRORS["chat_upstream"],
        ) from None

    return {"answer": answer}
