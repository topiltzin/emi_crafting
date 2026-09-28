"""Stability AI's stable-fast-3d REST call for one job.

Unlike TRELLIS.2 (Hugging Face Space, three chained calls on one session), stable-fast-3d is a
single synchronous HTTP call: POST the image, get the .glb bytes back in the response body. See
https://platform.stability.ai/docs/api-reference for the endpoint.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import httpx

from .errors import ConversionError, classify

log = logging.getLogger(__name__)

API_URL = "https://api.stability.ai/v2beta/3d/stable-fast-3d"
ACCOUNT_URL = "https://api.stability.ai/v1/user/account"

SETTINGS_KEYS = ("texture_resolution", "foreground_ratio", "remesh", "vertex_count")

# https://platform.stability.ai/docs/api-reference error shapes for this endpoint.
_STATUS_CODES: dict[int, str] = {
    400: "INVALID_IMAGE",
    403: "INVALID_IMAGE",  # content moderation
    404: "INTERNAL",
    413: "INVALID_IMAGE",  # payload too large
    422: "INVALID_IMAGE",  # unprocessable image (e.g. no subject found)
    402: "SERVICE_QUOTA",  # insufficient credits
    429: "SERVICE_BUSY",
    500: "INTERNAL",
    502: "SERVICE_BUSY",
    503: "SERVICE_BUSY",
    504: "SERVICE_BUSY",
}

ClientFactory = Any


def _error_detail(resp: httpx.Response) -> str | None:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:200] if resp.text else None
    if isinstance(body, dict):
        detail = body.get("errors") or body.get("message") or body.get("name")
        return str(detail) if detail else None
    return None


def _classify_response(resp: httpx.Response) -> ConversionError:
    code = _STATUS_CODES.get(resp.status_code, "INTERNAL")
    log.warning("stable-fast-3d returned HTTP %s: %s", resp.status_code, _error_detail(resp))
    return ConversionError(code)


def generate_glb(
    image_path: Path,
    seed: int,  # noqa: ARG001 - stable-fast-3d has no seed parameter; kept for interface parity
    settings: dict[str, Any],
    *,
    api_key: str,
    deadline: float,
    client_factory: ClientFactory = httpx.Client,
    **_ignored: Any,
) -> bytes:
    """Calls stable-fast-3d once and returns the raw GLB bytes.

    `deadline` is a time.monotonic() value bounding the single request.
    """
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ConversionError("TIMEOUT")

    data = {key: str(settings[key]) for key in SETTINGS_KEYS}

    try:
        with client_factory(timeout=remaining) as client, image_path.open("rb") as image_file:
            resp: httpx.Response = client.post(
                API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Accept": "model/gltf-binary",
                },
                files={"image": (image_path.name, image_file, "image/jpeg")},
                data=data,
            )
    except httpx.TimeoutException as exc:
        raise ConversionError("TIMEOUT") from exc
    except httpx.TransportError as exc:
        raise classify(exc) from exc

    if resp.status_code != 200:
        raise _classify_response(resp)

    return resp.content


def check_api(api_key: str, client_factory: ClientFactory = httpx.Client) -> None:
    """Fails fast at startup if the Stability AI API key is missing or revoked."""
    try:
        with client_factory(timeout=10) as client:
            resp = client.get(ACCOUNT_URL, headers={"Authorization": f"Bearer {api_key}"})
    except httpx.TransportError as exc:
        raise RuntimeError(f"Could not reach Stability AI: {exc}") from exc
    if resp.status_code == 401:
        raise RuntimeError("Stability AI API key is invalid or was revoked")
    if resp.status_code != 200:
        raise RuntimeError(f"Stability AI account check failed: HTTP {resp.status_code}")
