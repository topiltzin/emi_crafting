"""stable-fast-3d call for one job, via a public Hugging Face Space's REST API.

A single synchronous HTTP call: POST the image as multipart/form-data, get the .glb bytes back in
the response body. No API key. The Space's schema is at <SF3D_API_URL root>/openapi.json.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import httpx

from .errors import ConversionError, classify

log = logging.getLogger(__name__)

DEFAULT_API_URL = "https://ahmad-sarmad-ali-3d-model-ai.hf.space/generate-3d/"

# The Space only reads `image`; it doesn't declare texture_resolution, but we send it the way its
# example request does in case it's honored.
SETTINGS_KEYS = ("texture_resolution",)

GLB_MAGIC = b"glTF"

_STATUS_CODES: dict[int, str] = {
    400: "INVALID_IMAGE",
    413: "INVALID_IMAGE",  # payload too large
    422: "INVALID_IMAGE",  # FastAPI validation error
    429: "SERVICE_BUSY",
    500: "INTERNAL",
    502: "SERVICE_BUSY",
    503: "SERVICE_BUSY",  # Space sleeping or restarting
    504: "SERVICE_BUSY",
}

ClientFactory = Any


def _error_detail(resp: httpx.Response) -> str | None:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:200] if resp.text else None
    if isinstance(body, dict):
        detail = body.get("detail") or body.get("error") or body.get("message")
        return str(detail)[:200] if detail else None
    return None


def _classify_response(resp: httpx.Response) -> ConversionError:
    code = _STATUS_CODES.get(resp.status_code, "INTERNAL")
    log.warning("3D Space returned HTTP %s: %s", resp.status_code, _error_detail(resp))
    return ConversionError(code)


def generate_glb(
    image_path: Path,
    seed: int,  # noqa: ARG001 - the Space has no seed parameter; kept for interface parity
    settings: dict[str, Any],
    *,
    api_url: str,
    deadline: float,
    client_factory: ClientFactory = httpx.Client,
    **_ignored: Any,
) -> bytes:
    """POSTs the image to the Space once and returns the raw GLB bytes.

    `deadline` is a time.monotonic() value bounding the single request.
    """
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ConversionError("TIMEOUT")

    data = {key: str(settings[key]) for key in SETTINGS_KEYS}

    try:
        with client_factory(timeout=remaining) as client, image_path.open("rb") as image_file:
            resp: httpx.Response = client.post(
                api_url,
                headers={"Accept": "*/*"},
                files={"image": (image_path.name, image_file, "image/jpeg")},
                data=data,
            )
    except httpx.TimeoutException as exc:
        raise ConversionError("TIMEOUT") from exc
    except httpx.TransportError as exc:
        raise classify(exc) from exc

    if resp.status_code != 200:
        raise _classify_response(resp)

    # A 200 with a JSON error body instead of a model shouldn't be saved as a .glb.
    if not resp.content.startswith(GLB_MAGIC):
        log.warning("3D Space returned 200 without a GLB body: %s", _error_detail(resp))
        raise ConversionError("INTERNAL")

    return resp.content


def check_api(api_url: str, client_factory: ClientFactory = httpx.Client) -> None:
    """Logs whether the Space answers at startup. Never fatal: a sleeping Space wakes on the
    first real request, so exiting here would only put the container in a restart loop."""
    root = api_url.split("/generate-3d", 1)[0] + "/"
    try:
        with client_factory(timeout=30) as client:
            resp = client.get(root)
    except httpx.TransportError as exc:
        log.warning("3D Space %s not reachable yet: %s", root, exc)
        return
    if resp.status_code != 200:
        log.warning("3D Space %s answered HTTP %s (may be waking up)", root, resp.status_code)
        return
    log.info("3D Space %s is up", root)
