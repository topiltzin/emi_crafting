from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

DEFAULT_SETTINGS: dict[str, Any] = {
    "texture_resolution": 1024,
    "foreground_ratio": 0.85,
    "remesh": "none",
    "vertex_count": -1,
}


@pytest.fixture
def default_settings() -> dict[str, Any]:
    return dict(DEFAULT_SETTINGS)


@pytest.fixture
def job_row():
    def make(**overrides: Any) -> dict[str, Any]:
        row: dict[str, Any] = {
            "id": "job-1",
            "owner_id": "owner-1",
            "photo_id": "photo-1",
            "status": "processing",
            "is_redo": False,
            "seed": 0,
            "settings": dict(DEFAULT_SETTINGS),
            "requested_at": "2026-09-27T10:00:00+00:00",
        }
        row.update(overrides)
        return row

    return make


@pytest.fixture
def fake_supabase() -> MagicMock:
    """MagicMock shaped like supabase-py's sync client (rpc/table/storage.from_)."""
    sb = MagicMock(name="supabase")
    bucket = MagicMock(name="bucket")
    sb.storage.from_.return_value = bucket
    return sb
