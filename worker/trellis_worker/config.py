"""Environment configuration for the worker (see worker/.env.example)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass

from dotenv import load_dotenv

from .sf3d import DEFAULT_API_URL

REQUIRED_VARS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
# The service key may also come from SUPABASE_SECRET_KEY (the name your-game uses).
KEY_FALLBACK = "SUPABASE_SECRET_KEY"
DEFAULT_QUEUE_MODE = "emi"


@dataclass(frozen=True)
class Config:
    supabase_url: str
    service_role_key: str
    sf3d_api_url: str = DEFAULT_API_URL
    poll_seconds: float = 10
    worker_id: str = ""
    queue_mode: str = DEFAULT_QUEUE_MODE


def load_config() -> Config:
    load_dotenv()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(KEY_FALLBACK)
    missing = [name for name in ("SUPABASE_URL",) if not os.environ.get(name)]
    if not service_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if missing or service_key is None:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    return Config(
        supabase_url=os.environ["SUPABASE_URL"],
        service_role_key=service_key,
        sf3d_api_url=os.environ.get("SF3D_API_URL") or DEFAULT_API_URL,
        poll_seconds=float(os.environ.get("POLL_SECONDS") or 10),
        worker_id=os.environ.get("WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}",
        queue_mode=os.environ.get("QUEUE_MODE") or DEFAULT_QUEUE_MODE,
    )
