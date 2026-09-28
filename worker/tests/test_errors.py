import httpx
import pytest

from trellis_worker.errors import USER_MESSAGES, ConversionError, classify


@pytest.mark.parametrize(
    ("exc", "code"),
    [
        (TimeoutError(), "TIMEOUT"),
        (RuntimeError("insufficient credits for this request"), "SERVICE_QUOTA"),
        (RuntimeError("Account balance: insufficient balance"), "SERVICE_QUOTA"),
        (ConnectionError("reset"), "SERVICE_BUSY"),
        (httpx.ConnectError("boom"), "SERVICE_BUSY"),
        (RuntimeError("HTTP 503 Service Unavailable"), "SERVICE_BUSY"),
        (RuntimeError("connection timed out"), "SERVICE_BUSY"),
        (KeyError("weird"), "INTERNAL"),
    ],
)
def test_classify(exc, code):
    err = classify(exc)
    assert err.code == code
    assert err.user_message == USER_MESSAGES[code]


def test_conversion_error_passes_through():
    original = ConversionError("RESULT_TOO_LARGE")
    assert classify(original) is original


def test_messages_never_include_exception_text():
    err = classify(RuntimeError("secret token hf_abc in traceback"))
    assert "hf_abc" not in err.user_message


def test_unknown_code_rejected():
    with pytest.raises(ValueError):
        ConversionError("NOPE")


def test_messages_fit_db_limit():
    assert all(len(m) <= 500 for m in USER_MESSAGES.values())
