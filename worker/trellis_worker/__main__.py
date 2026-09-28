"""Worker entry point: `python -m trellis_worker`.

Loop: time out stale jobs → claim the oldest queued job → run it → repeat; sleep when idle.
"""

from __future__ import annotations

import logging
import signal
import sys
import threading
from typing import Any

from .config import Config, load_config
from .job_runner import run_job
from .stability import check_api

log = logging.getLogger("trellis_worker")


def claim_next(sb: Any, worker_id: str) -> dict[str, Any] | None:
    data = sb.rpc("claim_model_conversion", {"p_worker_id": worker_id}).execute().data
    row = data[0] if isinstance(data, list) and data else data
    # A composite-returning function with no match comes back as a row of nulls.
    if not isinstance(row, dict) or not row.get("id"):
        return None
    return row


def run_cycle(sb: Any, cfg: Config) -> bool:
    """Runs one poll cycle; returns True if a job was processed."""
    stale = sb.rpc("fail_stale_model_conversions", {}).execute().data
    if stale:
        log.info("marked %s stale job(s) as timed out", stale)
    job = claim_next(sb, cfg.worker_id)
    if job is None:
        return False
    log.info("claimed job %s for photo %s", job["id"], job["photo_id"])
    run_job(sb, cfg, job)
    return True


def run_forever(sb: Any, cfg: Config, stop: threading.Event) -> None:
    log.info("worker %s polling every %ss", cfg.worker_id, cfg.poll_seconds)
    while not stop.is_set():
        try:
            if run_cycle(sb, cfg):
                continue  # more work may be waiting; claim again right away
        except Exception:
            log.exception("poll cycle failed")
        stop.wait(cfg.poll_seconds)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        cfg = load_config()
    except ValueError as exc:
        log.error("%s", exc)
        return 2

    from supabase import create_client

    sb = create_client(cfg.supabase_url, cfg.service_role_key)

    try:
        check_api(cfg.stability_api_key)
    except Exception:
        log.exception("Stability AI API key is not usable; exiting")
        return 1

    stop = threading.Event()

    def request_stop(signum: int, _frame: object) -> None:
        log.info("received signal %s; finishing current job then exiting", signum)
        stop.set()

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    run_forever(sb, cfg, stop)
    return 0


if __name__ == "__main__":
    sys.exit(main())
