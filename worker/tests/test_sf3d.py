from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import httpx
import pytest

from trellis_worker.errors import ConversionError
from trellis_worker.sf3d import check_api, generate_glb

API_URL = "https://space.test/generate-3d/"


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

    def _respond(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.requests.append({"method": method, "url": url, **kwargs})
        if isinstance(self.response, Exception):
            raise self.response
        return self.response

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._respond("post", url, **kwargs)

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._respond("get", url, **kwargs)


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


def call(image_file: Path, settings: dict[str, Any], factory: Any, deadline_in: float = 60):
    return generate_glb(
        image_file,
        0,
        settings,
        api_url=API_URL,
        deadline=time.monotonic() + deadline_in,
        client_factory=factory,
    )


def test_successful_call_returns_glb_bytes(image_file, default_settings):
    factory = factory_for(FakeResponse(200, content=b"glTF-bytes"))
    assert call(image_file, default_settings, factory) == b"glTF-bytes"

    req = FakeClient.instances[0].requests[0]
    assert req["url"] == API_URL
    assert req["data"] == {"texture_resolution": "1024"}
    assert req["files"]["image"][0] == "sample.jpg"
    assert req["files"]["image"][2] == "image/jpeg"
    assert "Authorization" not in req["headers"]


def test_non_glb_200_body_rejected(image_file, default_settings):
    factory = factory_for(FakeResponse(200, content=b'{"error":"x"}', json_body={"error": "x"}))
    with pytest.raises(ConversionError) as info:
        call(image_file, default_settings, factory)
    assert info.value.code == "INTERNAL"


def test_deadline_already_passed(image_file, default_settings):
    with pytest.raises(ConversionError) as info:
        call(image_file, default_settings, factory_for(FakeResponse(200)), deadline_in=-1)
    assert info.value.code == "TIMEOUT"
    assert FakeClient.instances == []


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "INVALID_IMAGE"),
        (413, "INVALID_IMAGE"),
        (422, "INVALID_IMAGE"),
        (429, "SERVICE_BUSY"),
        (503, "SERVICE_BUSY"),
        (500, "INTERNAL"),
        (418, "INTERNAL"),
    ],
)
def test_error_status_codes_classified(image_file, default_settings, status, code):
    factory = factory_for(FakeResponse(status, json_body={"detail": "nope"}))
    with pytest.raises(ConversionError) as info:
        call(image_file, default_settings, factory)
    assert info.value.code == code


def test_timeout_exception_maps_to_timeout(image_file, default_settings):
    with pytest.raises(ConversionError) as info:
        call(image_file, default_settings, factory_for(httpx.ConnectTimeout("timed out")))
    assert info.value.code == "TIMEOUT"


def test_transport_error_classified(image_file, default_settings):
    with pytest.raises(ConversionError) as info:
        call(image_file, default_settings, factory_for(httpx.ConnectError("boom")))
    assert info.value.code == "SERVICE_BUSY"


def test_check_api_hits_space_root(caplog):
    factory = factory_for(FakeResponse(200))
    with caplog.at_level(logging.INFO):
        check_api(API_URL, client_factory=factory)
    assert FakeClient.instances[0].requests[0]["url"] == "https://space.test/"
    assert "is up" in caplog.text


@pytest.mark.parametrize("response", [FakeResponse(503), httpx.ConnectError("down")])
def test_check_api_never_raises(caplog, response):
    check_api(API_URL, client_factory=factory_for(response))
    assert "3D Space" in caplog.text
