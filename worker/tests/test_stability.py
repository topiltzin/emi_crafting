from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import httpx
import pytest

from trellis_worker.errors import ConversionError
from trellis_worker.stability import API_URL, check_api, generate_glb


class FakeResponse:
    def __init__(self, status_code: int, content: bytes = b"", json_body: Any = None) -> None:
        self.status_code = status_code
        self.content = content
        self.text = content.decode("utf-8", errors="ignore")
        self._json_body = json_body

    def json(self) -> Any:
        if self._json_body is None:
            raise ValueError("no json body")
        return self._json_body


class FakeClient:
    instances: list[FakeClient] = []

    def __init__(self, response: FakeResponse | Exception, **kwargs: Any) -> None:
        self.response = response
        self.kwargs = kwargs
        self.requests: list[dict[str, Any]] = []
        FakeClient.instances.append(self)

    def __enter__(self) -> FakeClient:
        return self

    def __exit__(self, *exc: Any) -> None:
        return None

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        self.requests.append({"method": "post", "url": url, **kwargs})
        if isinstance(self.response, Exception):
            raise self.response
        return self.response

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        self.requests.append({"method": "get", "url": url, **kwargs})
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def factory_for(response: FakeResponse | Exception):
    FakeClient.instances = []

    def factory(**kwargs: Any) -> FakeClient:
        return FakeClient(response, **kwargs)

    return factory


@pytest.fixture
def image_file(tmp_path: Path) -> Path:
    path = tmp_path / "sample.jpg"
    path.write_bytes(b"jpeg-bytes")
    return path


def test_successful_call_returns_glb_bytes(image_file, default_settings):
    factory = factory_for(FakeResponse(200, content=b"glTF-bytes"))
    data = generate_glb(
        image_file,
        0,
        default_settings,
        api_key="sk-x",
        deadline=time.monotonic() + 60,
        client_factory=factory,
    )
    assert data == b"glTF-bytes"

    req = FakeClient.instances[0].requests[0]
    assert req["url"] == API_URL
    assert req["headers"]["Authorization"] == "Bearer sk-x"
    assert req["data"] == {
        "texture_resolution": "1024",
        "foreground_ratio": "0.85",
        "remesh": "none",
        "vertex_count": "-1",
    }
    assert req["files"]["image"][0] == "sample.jpg"


def test_deadline_already_passed(image_file, default_settings):
    with pytest.raises(ConversionError) as info:
        generate_glb(
            image_file,
            0,
            default_settings,
            api_key="sk-x",
            deadline=time.monotonic() - 1,
            client_factory=factory_for(FakeResponse(200)),
        )
    assert info.value.code == "TIMEOUT"
    assert FakeClient.instances == []


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "INVALID_IMAGE"),
        (403, "INVALID_IMAGE"),
        (413, "INVALID_IMAGE"),
        (422, "INVALID_IMAGE"),
        (402, "SERVICE_QUOTA"),
        (429, "SERVICE_BUSY"),
        (503, "SERVICE_BUSY"),
        (500, "INTERNAL"),
        (418, "INTERNAL"),
    ],
)
def test_error_status_codes_classified(image_file, default_settings, status, code):
    factory = factory_for(FakeResponse(status, json_body={"message": "nope"}))
    with pytest.raises(ConversionError) as info:
        generate_glb(
            image_file,
            0,
            default_settings,
            api_key="sk-x",
            deadline=time.monotonic() + 60,
            client_factory=factory,
        )
    assert info.value.code == code


def test_timeout_exception_maps_to_timeout(image_file, default_settings):
    factory = factory_for(httpx.ConnectTimeout("timed out"))
    with pytest.raises(ConversionError) as info:
        generate_glb(
            image_file,
            0,
            default_settings,
            api_key="sk-x",
            deadline=time.monotonic() + 60,
            client_factory=factory,
        )
    assert info.value.code == "TIMEOUT"


def test_transport_error_classified(image_file, default_settings):
    factory = factory_for(httpx.ConnectError("boom"))
    with pytest.raises(ConversionError) as info:
        generate_glb(
            image_file,
            0,
            default_settings,
            api_key="sk-x",
            deadline=time.monotonic() + 60,
            client_factory=factory,
        )
    assert info.value.code == "SERVICE_BUSY"


def test_check_api_ok():
    check_api("sk-x", client_factory=factory_for(FakeResponse(200)))


def test_check_api_invalid_key():
    with pytest.raises(RuntimeError, match="invalid or was revoked"):
        check_api("sk-bad", client_factory=factory_for(FakeResponse(401)))


def test_check_api_other_error():
    with pytest.raises(RuntimeError, match="HTTP 500"):
        check_api("sk-x", client_factory=factory_for(FakeResponse(500)))


def test_check_api_transport_error():
    with pytest.raises(RuntimeError, match="Could not reach"):
        check_api("sk-x", client_factory=factory_for(httpx.ConnectError("down")))
