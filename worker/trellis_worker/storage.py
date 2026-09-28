"""Supabase Storage access for the worker (service role; bypasses Storage RLS)."""

from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger(__name__)

PHOTOS_BUCKET = "photos"
GLB_CONTENT_TYPE = "model/gltf-binary"


def model_path(owner_id: str, photo_id: str, job_id: str) -> str:
    # Must match the photos_model_path_prefix CHECK constraint and the owner-folder Storage policy.
    return f"{owner_id}/{photo_id}/model-{job_id}.glb"


def download_original(sb: Any, storage_path: str) -> bytes:
    data = sb.storage.from_(PHOTOS_BUCKET).download(storage_path)
    return bytes(data)


def upload_model(sb: Any, path: str, data: bytes) -> None:
    sb.storage.from_(PHOTOS_BUCKET).upload(
        path, data, {"content-type": GLB_CONTENT_TYPE, "upsert": "false"}
    )


def remove_paths(sb: Any, paths: list[str]) -> None:
    paths = [p for p in paths if p]
    if not paths:
        return
    try:
        sb.storage.from_(PHOTOS_BUCKET).remove(paths)
    except Exception:
        log.exception("Failed to remove storage objects %s", paths)
