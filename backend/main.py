from env_loader import load_scanora_env

# Load C:\Project\Scanora\.env before Gemini settings are read.
load_scanora_env()

import asyncio
import logging
import time
from threading import Lock
from uuid import uuid4

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
logger = logging.getLogger("scanora.api")

# In-process job storage is for a single backend process only. A restart loses
# active jobs; replicas/workers need a shared queue and task store.
ANALYSIS_TASK_TTL_SECONDS = 30 * 60
MAX_ANALYSIS_TASKS = 128
MAX_ACTIVE_ANALYSIS_TASKS = 4
_ANALYSIS_TASKS: dict[str, dict] = {}
_ANALYSIS_WORKERS: set[asyncio.Task] = set()

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
    "unavailable": 503,
    "quota": 429,
    "malformed_request": 400,
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


def _prune_analysis_tasks(now: float) -> None:
    expired = [
        task_id
        for task_id, task in _ANALYSIS_TASKS.items()
        if task["status"] != "processing"
        and now - task["updated_at"] >= ANALYSIS_TASK_TTL_SECONDS
    ]
    for task_id in expired:
        del _ANALYSIS_TASKS[task_id]

    excess = len(_ANALYSIS_TASKS) - MAX_ANALYSIS_TASKS + 1
    if excess > 0:
        completed = sorted(
            (
                (task["updated_at"], task_id)
                for task_id, task in _ANALYSIS_TASKS.items()
                if task["status"] != "processing"
            )
        )
        for _updated_at, task_id in completed[:excess]:
            del _ANALYSIS_TASKS[task_id]


def reset_analysis_tasks() -> None:
    """Clear in-memory analysis tasks (test hook)."""
    _ANALYSIS_TASKS.clear()


async def _run_analysis_task(
    task_id: str,
    file_parts: list[tuple[bytes, str]],
    source_ids: list[str],
    source_labels: dict[str, str],
) -> None:
    task = _ANALYSIS_TASKS[task_id]
    try:
        analysis = await analyze_report_files(file_parts, source_ids)
        analysis["reports"] = [
            {
                **report,
                "source_label": source_labels.get(report["source_id"], "report"),
            }
            for report in analysis["reports"]
        ]
        task["result"] = {
            "success": True,
            "analysis": analysis,
            "analysis_id": seal_analysis(analysis),
        }
        task["status"] = "completed"
    except GeminiServiceError as error:
        task["error"] = HUMAN_ERRORS.get(error.code, HUMAN_ERRORS["upstream"])
        task["error_status"] = GEMINI_ERROR_STATUS.get(error.code, 502)
        task["status"] = "failed"
    except Exception:
        logger.exception("Unexpected analysis task failure task_id=%s", task_id)
        task["error"] = HUMAN_ERRORS["processing"]
        task["error_status"] = 500
        task["status"] = "failed"
    finally:
        task["updated_at"] = time.monotonic()


@app.post("/api/analyze", status_code=202)
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
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail=HUMAN_ERRORS["processing"]) from None
    finally:
        for upload in files:
            await upload.close()

    now = time.monotonic()
    _prune_analysis_tasks(now)
    active_tasks = sum(
        task["status"] == "processing" for task in _ANALYSIS_TASKS.values()
    )
    if active_tasks >= MAX_ACTIVE_ANALYSIS_TASKS:
        raise HTTPException(
            status_code=503,
            detail="Analysis is busy. Please wait a moment and try again.",
            headers={"Retry-After": "5"},
        )
    if len(_ANALYSIS_TASKS) >= MAX_ANALYSIS_TASKS:
        raise HTTPException(
            status_code=503,
            detail="Analysis status storage is busy. Please try again shortly.",
            headers={"Retry-After": "5"},
        )

    task_id = uuid4().hex
    _ANALYSIS_TASKS[task_id] = {
        "status": "processing",
        "created_at": now,
        "updated_at": now,
    }
    worker = asyncio.create_task(
        _run_analysis_task(task_id, file_parts, source_ids, source_labels)
    )
    _ANALYSIS_WORKERS.add(worker)
    worker.add_done_callback(_ANALYSIS_WORKERS.discard)
    return {"task_id": task_id, "status": "processing"}


@app.get("/api/analyze/status/{task_id}")
def analysis_status(task_id: str):
    _prune_analysis_tasks(time.monotonic())
    task = _ANALYSIS_TASKS.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Analysis task not found or expired.")
    response = {"task_id": task_id, "status": task["status"]}
    if task["status"] == "completed":
        response.update(task["result"])
    elif task["status"] == "failed":
        response["error"] = task["error"]
        response["error_status"] = task["error_status"]
    return response


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
    "unavailable": HUMAN_ERRORS["unavailable"],
    "quota": HUMAN_ERRORS["quota"],
    "malformed_request": HUMAN_ERRORS["malformed_request"],
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
