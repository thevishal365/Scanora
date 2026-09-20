"""Short-lived HMAC-signed analysis identity for report-bound chat (H1).

The token is HMAC-signed, readable, tamper-evident; not encrypted. The
payload (version, expiry, full analysis) is only base64-encoded, so anyone
holding the token can decode and read it — acceptable because the holder is
the same user who just received that same analysis from /api/analyze. The
signature provides integrity (the analysis Gemini receives is the one the
server issued), not confidentiality. Never place secrets in the token.

Why a signed token instead of in-memory TTL storage:
- Scanora is a no-database, stateless backend (frontend on Netlify, backend
  potentially running with multiple uvicorn workers or scaled instances).
- An in-memory dict would break provenance across workers/restarts and add
  an unbounded memory-DoS surface.
- An HMAC-signed (stdlib-only, no new dependency) token keeps the server
  stateless: /api/analyze signs the normalized analysis, /api/chat verifies
  the signature and expiry and re-validates the payload shape before use.
- Trade-off: the token (~analysis JSON size, a few KB) travels in the chat
  POST body. That is the same order of magnitude as the previous design
  (which sent the full context anyway), but now integrity-protected.

Secret resolution: SCANORA_SESSION_SECRET (preferred, set it in production
especially with multiple workers) -> GEMINI_API_KEY-derived key -> ephemeral
per-process key (dev/test only; tokens do not survive restarts).
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time

from env_loader import load_scanora_env
from services.analysis_schema import GeminiServiceError, validate_analysis_payload

logger = logging.getLogger("scanora.analysis_token")

ANALYSIS_TOKEN_TTL_SECONDS = 6 * 60 * 60  # 6 hours; session-only use
_TOKEN_VERSION = 1

_ephemeral_secret: bytes | None = None


class AnalysisTokenError(Exception):
    """Raised when an analysis identity is missing, forged, or expired."""


def _signing_secret() -> bytes:
    load_scanora_env()
    configured = (os.getenv("SCANORA_SESSION_SECRET") or "").strip()
    if configured:
        return b"scanora-chat-v1:" + configured.encode("utf-8")
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if api_key:
        return b"scanora-chat-v1:" + api_key.encode("utf-8")
    global _ephemeral_secret
    if _ephemeral_secret is None:
        _ephemeral_secret = os.urandom(32)
        logger.warning(
            "No SCANORA_SESSION_SECRET or GEMINI_API_KEY configured; using an "
            "ephemeral analysis-token secret. Set SCANORA_SESSION_SECRET in "
            "production (required with multiple workers)."
        )
    return b"scanora-ephemeral-v1:" + _ephemeral_secret


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def seal_analysis(analysis: dict) -> str:
    """Create a short-lived HMAC-signed identity for a validated analysis.

    Readable, tamper-evident; not encrypted (see module docstring).
    """
    payload = {
        "v": _TOKEN_VERSION,
        "exp": int(time.time()) + ANALYSIS_TOKEN_TTL_SECONDS,
        "analysis": analysis,
    }
    raw = json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    body = _b64encode(raw)
    signature = hmac.new(_signing_secret(), body.encode("ascii"), hashlib.sha256).digest()
    return body + "." + _b64encode(signature)


def unseal_analysis(token: str | None) -> dict:
    """Verify an analysis identity and return the server-validated analysis.

    Raises AnalysisTokenError on any problem (forge, expiry, bad shape).
    The returned analysis is re-validated with validate_analysis_payload so
    only well-formed analyses reach Gemini.
    """
    if not token or not isinstance(token, str):
        raise AnalysisTokenError("missing analysis identity")
    parts = token.strip().split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise AnalysisTokenError("malformed analysis identity")
    body, provided_sig = parts
    expected_sig = _b64encode(
        hmac.new(_signing_secret(), body.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(provided_sig, expected_sig):
        raise AnalysisTokenError("invalid analysis identity signature")
    try:
        payload = json.loads(_b64decode(body).decode("utf-8"))
    except Exception as exc:
        raise AnalysisTokenError("unreadable analysis identity") from exc
    if not isinstance(payload, dict) or payload.get("v") != _TOKEN_VERSION:
        raise AnalysisTokenError("unsupported analysis identity")
    expiry = payload.get("exp")
    if not isinstance(expiry, int) or expiry < int(time.time()):
        raise AnalysisTokenError("expired analysis identity")
    analysis = payload.get("analysis")
    try:
        return validate_analysis_payload(analysis)
    except GeminiServiceError as exc:
        raise AnalysisTokenError("invalid embedded analysis") from exc
