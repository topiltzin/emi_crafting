"""Environment configuration for the worker (see worker/.env.example)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass

from dotenv import load_dotenv

from .sf3d import DEFAULT_API_URL

REQUIRED_VARS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")


@dataclass(frozen=True)
class Config:
    supabase_url: str
    service_role_key: str
    sf3d_api_url: str = DEFAULT_API_URL
    poll_seconds: float = 10
    worker_id: str = ""


def load_config() -> Config:
    load_dotenv()
    missing = [name for name in REQUIRED_VARS if not os.environ.get(name)]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    return Config(
        supabase_url=os.environ["SUPABASE_URL"],
        service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        sf3d_api_url=os.environ.get("SF3D_API_URL") or DEFAULT_API_URL,
        poll_seconds=float(os.environ.get("POLL_SECONDS") or 10),
        worker_id=os.environ.get("WORKER_ID") or f"{socket.gethostname()}-{os.getpid()}",
    )
