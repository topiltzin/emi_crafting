"""Runs one claimed conversion job end to end (data-model.md "Completing a job")."""

from __future__ import annotations

import logging
import tempfile
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .config import Config
from .errors import ConversionError, classify
from .image_prep import prepare_image
from .settings import validate_settings
from .sf3d import generate_glb
from .storage import download_original, model_path, remove_paths, upload_model

log = logging.getLogger(__name__)

JOB_DEADLINE_SECONDS = 10 * 60
MAX_MODEL_BYTES = 52_428_800  # 50 MB — FR-016, and the photos_model_file_size_range constraint

Generate = Callable[..., bytes]


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def monotonic_deadline(requested_at: str, now: datetime | None = None) -> float:
    """Converts the job's wall-clock deadline (requested_at + 10 min) to a monotonic time."""
    now = now or datetime.now(UTC)
    remaining = _parse_timestamp(requested_at).timestamp() + JOB_DEADLINE_SECONDS - now.timestamp()
    return time.monotonic() + remaining


def _rows(data: Any) -> list[dict[str, Any]]:
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def _load_photo(sb: Any, photo_id: str) -> dict[str, Any] | None:
    resp = (
        sb.table("photos")
        .select("storage_path, deleted_at")
        .eq("id", photo_id)
        .maybe_single()
        .execute()
    )
    # supabase-py returns None (not a response) from maybe_single() when no row matches.
    if resp is None or not resp.data:
        return None
    return dict(resp.data)


def run_job(
    sb: Any,
    cfg: Config,
    job: dict[str, Any],
    *,
    generate: Generate = generate_glb,
) -> None:
    job_id = str(job["id"])
    uploaded: str | None = None
    try:
        photo = _load_photo(sb, str(job["photo_id"]))
        if photo is None:
            # Hard-deleted: the job row is already gone by ON DELETE CASCADE.
            log.info("job %s discarded: photo %s no longer exists", job_id, job["photo_id"])
            return

        settings = validate_settings(dict(job["settings"]))
        deadline = monotonic_deadline(str(job["requested_at"]))

        with tempfile.TemporaryDirectory(prefix=f"model-{job_id}-") as tmp:
            workdir = Path(tmp)
            image_path = prepare_image(download_original(sb, photo["storage_path"]), workdir)
            glb = generate(
                image_path,
                int(job["seed"]),
                settings,
                api_url=cfg.sf3d_api_url,
                deadline=deadline,
            )

        if len(glb) > MAX_MODEL_BYTES:
            raise ConversionError("RESULT_TOO_LARGE")

        path = model_path(str(job["owner_id"]), str(job["photo_id"]), job_id)
        upload_model(sb, path, glb)
        uploaded = path

        result = _rows(
            sb.rpc(
                "complete_model_conversion",
                {"p_job_id": job_id, "p_path": path, "p_size": len(glb)},
            )
            .execute()
            .data
        )
        outcome = result[0] if result else {"discard": True, "old_path": None}

        if outcome.get("discard"):
            log.info("job %s discarded: photo deleted or job no longer processing", job_id)
            remove_paths(sb, [path])
            return

        if outcome.get("old_path"):
            remove_paths(sb, [str(outcome["old_path"])])
        log.info("job %s completed: %s (%d bytes)", job_id, path, len(glb))

    except Exception as exc:
        err = classify(exc)
        log.exception("job %s failed with %s", job_id, err.code)
        if uploaded:
            remove_paths(sb, [uploaded])
        try:
            sb.rpc(
                "fail_model_conversion",
                {"p_job_id": job_id, "p_code": err.code, "p_message": err.user_message},
            ).execute()
        except Exception:
            log.exception("job %s: could not record failure", job_id)
