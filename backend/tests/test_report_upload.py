from pathlib import Path

from report_upload import (
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_FILE_BYTES,
    content_matches_type,
    extension_and_mime_agree,
    extension_error_message,
    file_extension,
    mime_for_extension,
    mime_is_allowed,
)

FIXTURE_PDF = (Path(__file__).parent / "fixtures" / "sample.pdf").read_bytes()

JPEG_BYTES = b"\xff\xd8\xff" + b"jpeg-body"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"png-body"
PDF_BYTES = FIXTURE_PDF
TEXT_BYTES = b"hello world, definitely not a pdf"


def test_allowed_extensions_include_pdf():
    assert ".pdf" in ALLOWED_EXTENSIONS
    assert {".jpg", ".jpeg", ".png"} <= ALLOWED_EXTENSIONS


def test_allowed_mime_types_include_pdf():
    assert "application/pdf" in ALLOWED_MIME_TYPES


def test_file_extension_pdf():
    assert file_extension("report.pdf") == ".pdf"
    assert file_extension("report.PDF") == ".pdf"
    assert file_extension("report.Pdf") == ".pdf"


def test_file_extension_existing_cases():
    assert file_extension("cbc.jpg") == ".jpg"
    assert file_extension("cbc.jpeg") == ".jpeg"
    assert file_extension("cbc.png") == ".png"


def test_mime_is_allowed_pdf():
    assert mime_is_allowed("application/pdf") is True


def test_mime_is_allowed_existing_cases():
    assert mime_is_allowed("image/jpeg") is True
    assert mime_is_allowed("image/jpg") is True
    assert mime_is_allowed("image/png") is True
    assert mime_is_allowed("") is True
    assert mime_is_allowed("text/plain") is False


def test_extension_and_mime_agree_pdf():
    assert extension_and_mime_agree(".pdf", "application/pdf") is True
    assert extension_and_mime_agree(".pdf", "image/jpeg") is False


def test_extension_and_mime_agree_existing_cases():
    assert extension_and_mime_agree(".jpg", "image/jpeg") is True
    assert extension_and_mime_agree(".jpeg", "image/jpg") is True
    assert extension_and_mime_agree(".png", "image/png") is True
    assert extension_and_mime_agree(".png", "image/jpeg") is False


def test_content_matches_type_pdf():
    assert content_matches_type(".pdf", PDF_BYTES) is True
    assert content_matches_type(".pdf", JPEG_BYTES) is False
    assert content_matches_type(".pdf", TEXT_BYTES) is False


def test_content_matches_type_existing_cases():
    assert content_matches_type(".jpg", JPEG_BYTES) is True
    assert content_matches_type(".jpeg", JPEG_BYTES) is True
    assert content_matches_type(".png", PNG_BYTES) is True
    assert content_matches_type(".jpg", PNG_BYTES) is False
    assert content_matches_type(".jpeg", PNG_BYTES) is False


def test_mime_for_extension_pdf():
    assert mime_for_extension(".pdf") == "application/pdf"


def test_mime_for_extension_existing_cases():
    assert mime_for_extension(".jpg") == "image/jpeg"
    assert mime_for_extension(".jpeg") == "image/jpeg"
    assert mime_for_extension(".png") == "image/png"


def test_extension_error_message_pdf_no_longer_rejected():
    message = extension_error_message("report.pdf")
    assert "not supported" not in message.lower()


def test_unsupported_extensions_still_have_specific_messages():
    assert "Word documents are not supported" in extension_error_message("report.docx")
    assert "Word documents are not supported" in extension_error_message("report.doc")
    assert "Text files are not supported" in extension_error_message("notes.txt")


def test_boundary_exact_10mb_pdf_content_passes_magic_check():
    payload = PDF_BYTES + b"\x00" * (MAX_FILE_BYTES - len(PDF_BYTES))
    assert len(payload) == MAX_FILE_BYTES
    assert content_matches_type(".pdf", payload) is True