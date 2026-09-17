from pathlib import Path

MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}
UNKNOWN_MIME_TYPES = {"", "application/octet-stream"}
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
PDF_MAGIC = b"%PDF-"
READ_CHUNK_BYTES = 1024 * 1024

HUMAN_ERRORS = {
    "no_files": "Choose at least one report image before analyzing.",
    "empty": "One of the files was empty. Please upload a JPG, JPEG, PNG, or PDF file.",
    "too_large": "Each file must be 10 MB or smaller.",
    "unsupported": "Only JPG, JPEG, PNG, and PDF files are supported.",
    "not_image": "One of the files is not a valid JPG, JPEG, PNG, or PDF file.",
    "malformed": "The upload could not be processed. Please try again.",
    "not_configured": "Scanora is not configured to analyze reports yet.",
    "auth": "Scanora could not connect to the analysis service. Please try again later.",
    "timeout": "Analyzing your reports took too long. Please try again.",
    "invalid_response": "Scanora could not read the analysis result. Please try again.",
    "empty_response": "No analysis was returned for these reports. Please try again.",
    "upstream": "Your reports could not be analyzed right now. Please try again.",
    "quota": "Scanora has reached the current Gemini request limit. Please wait a minute and try again.",
    "processing": "Something went wrong while reading your reports. Please try again.",
    "chat_empty": "Type a question about your report before sending.",
    "chat_context": "Analyze a report before asking a question.",
    "chat_upstream": "Your question could not be answered right now. Please try again.",
    "chat_timeout": "That question took too long. Please try again.",
    "chat_invalid": "Scanora could not read the chat reply. Please try again.",
}


def file_extension(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return Path(filename).suffix.lower()


def extension_error_message(filename: str | None) -> str:
    extension = file_extension(filename)
    if extension in {".doc", ".docx"}:
        return "Word documents are not supported. Please upload JPG, JPEG, or PNG images."
    if extension == ".txt":
        return "Text files are not supported. Please upload JPG, JPEG, or PNG images."
    return HUMAN_ERRORS["unsupported"]


def looks_like_jpeg(content: bytes) -> bool:
    return content.startswith(JPEG_MAGIC)


def looks_like_png(content: bytes) -> bool:
    return content.startswith(PNG_MAGIC)


def looks_like_pdf(content: bytes) -> bool:
    return content.startswith(PDF_MAGIC)


def mime_is_allowed(mime_type: str) -> bool:
    return mime_type in ALLOWED_MIME_TYPES or mime_type in UNKNOWN_MIME_TYPES


def extension_and_mime_agree(extension: str, mime_type: str) -> bool:
    if mime_type in UNKNOWN_MIME_TYPES:
        return True
    if extension in {".jpg", ".jpeg"}:
        return mime_type in {"image/jpeg", "image/jpg"}
    if extension == ".png":
        return mime_type == "image/png"
    if extension == ".pdf":
        return mime_type == "application/pdf"
    return False


def content_matches_type(extension: str, content: bytes) -> bool:
    if extension in {".jpg", ".jpeg"}:
        return looks_like_jpeg(content)
    if extension == ".png":
        return looks_like_png(content)
    if extension == ".pdf":
        return looks_like_pdf(content)
    return False


def mime_for_extension(extension: str) -> str:
    if extension in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if extension == ".png":
        return "image/png"
    if extension == ".pdf":
        return "application/pdf"
    return "application/octet-stream"
