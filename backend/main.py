from env_loader import load_scanora_env

# Load C:\Project\Scanora\.env before Gemini settings are read.
load_scanora_env()

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from report_upload import (
    ALLOWED_EXTENSIONS,
    HUMAN_ERRORS,
    MAX_FILE_BYTES,
    READ_CHUNK_BYTES,
    content_matches_type,
    extension_and_mime_agree,
    extension_error_message,
    file_extension,
    mime_for_extension,
    mime_is_allowed,
)
from services.analysis_schema import GeminiServiceError
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
async def analyze(files: list[UploadFile] | None = File(default=None)):
    if not files:
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["no_files"])

    file_parts = []

    try:
        for upload in files:
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

            file_parts.append((content, mime_for_extension(extension)))

        analysis = await analyze_report_files(file_parts)
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
    }


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    report_context: dict
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
async def chat(payload: ChatRequest):
    user_message = (payload.message or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["chat_empty"])

    if len(user_message) > MAX_CHAT_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail="Please keep your question shorter so it can be answered clearly.",
        )

    if not isinstance(payload.report_context, dict) or not payload.report_context:
        raise HTTPException(status_code=400, detail=HUMAN_ERRORS["chat_context"])

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
            payload.report_context,
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
