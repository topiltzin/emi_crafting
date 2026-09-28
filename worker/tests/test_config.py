import pytest

from trellis_worker import config as config_module
from trellis_worker.config import load_config
from trellis_worker.sf3d import DEFAULT_API_URL


@pytest.fixture(autouse=True)
def no_dotenv(monkeypatch):
    monkeypatch.setattr(config_module, "load_dotenv", lambda: None)
    for name in (
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SF3D_API_URL",
        "POLL_SECONDS",
        "WORKER_ID",
    ):
        monkeypatch.delenv(name, raising=False)


def test_missing_required_vars_are_named(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    with pytest.raises(ValueError, match="SUPABASE_SERVICE_ROLE_KEY"):
        load_config()


def test_defaults_applied(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    cfg = load_config()
    assert cfg.sf3d_api_url == DEFAULT_API_URL
    assert cfg.poll_seconds == 10
    assert cfg.worker_id


def test_overrides(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "u")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    monkeypatch.setenv("SF3D_API_URL", "https://mine.hf.space/generate-3d/")
    monkeypatch.setenv("POLL_SECONDS", "3")
    monkeypatch.setenv("WORKER_ID", "w-9")
    cfg = load_config()
    assert (cfg.sf3d_api_url, cfg.poll_seconds, cfg.worker_id) == (
        "https://mine.hf.space/generate-3d/",
        3.0,
        "w-9",
    )
