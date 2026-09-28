"""Maps any failure during a conversion to an error_code + friendly message.

Codes and messages mirror specs/009-photo-to-3d-model/data-model.md ("Error codes") and the
CHECK constraint on model_conversions.error_code. The message is shown to the user as-is, so it
must never contain exception text or tracebacks — those only go to the worker log.
"""

from __future__ import annotations

import re

USER_MESSAGES: dict[str, str] = {
    "TIMEOUT": "This one took too long. Want to try again?",
    "SERVICE_BUSY": "The 3D maker is busy right now. Try again in a little while.",
    "SERVICE_QUOTA": "The 3D maker is out of energy for today — try again later.",
    "INVALID_IMAGE": "We couldn't read this photo. Try a clearer photo of one object.",
    "RESULT_TOO_LARGE": "The 3D model came out too big to save. Try again.",
    "INTERNAL": "Something went wrong making the 3D model. Try again.",
}

_QUOTA_PATTERN = re.compile(r"insufficient.*(credit|balance)|out of credit", re.IGNORECASE)
_BUSY_PATTERN = re.compile(
    r"queue is full|sleeping|is building|runtime error|\b50[0-4]\b|connection|timed out",
    re.IGNORECASE,
)


class ConversionError(Exception):
    def __init__(self, code: str, user_message: str | None = None) -> None:
        if code not in USER_MESSAGES:
            raise ValueError(f"Unknown conversion error code: {code}")
        self.code = code
        self.user_message = user_message or USER_MESSAGES[code]
        super().__init__(f"{code}: {self.user_message}")


def classify(exc: BaseException) -> ConversionError:
    if isinstance(exc, ConversionError):
        return exc
    if isinstance(exc, TimeoutError):
        return ConversionError("TIMEOUT")

    message = str(exc)
    if _QUOTA_PATTERN.search(message):
        return ConversionError("SERVICE_QUOTA")
    if isinstance(exc, ConnectionError) or _is_httpx_transport_error(exc):
        return ConversionError("SERVICE_BUSY")
    if _BUSY_PATTERN.search(message):
        return ConversionError("SERVICE_BUSY")
    return ConversionError("INTERNAL")


def _is_httpx_transport_error(exc: BaseException) -> bool:
    try:
        import httpx
    except ImportError:  # pragma: no cover - httpx is a direct dependency
        return False
    return isinstance(exc, httpx.TransportError)
