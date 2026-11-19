"""Queue profiles: `sketch` serves your-game's model_jobs queue; `emi` stays the default."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from PIL import Image

from trellis_worker import __main__ as main_module
from trellis_worker import config as config_module
from trellis_worker.config import Config, load_config
from trellis_worker.job_runner import run_job
from trellis_worker.profiles import EMI_PROFILE, SKETCH_PROFILE, get_profile

CFG = Config(
    supabase_url="u",
    service_role_key="k",
    sf3d_api_url="https://space.test/generate-3d/",
    worker_id="w1",
)
SETTINGS = {
    "texture_resolution": 1024,
    "foreground_ratio": 0.85,
    "remesh": "none",
    "vertex_count": -1,
}


def jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "blue").save(buf, format="JPEG")
    return buf.getvalue()


def sketch_job(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": "job-1",
        "input_key": "inputs/11111111-1111-4111-8111-111111111111.jpg",
        "texture_resolution": 1024,
        "status": "processing",
        "seed": 0,
        "settings": dict(SETTINGS),
        "requested_at": datetime.now(UTC).isoformat(),
    }
    row.update(overrides)
    return row


@pytest.fixture
def sb() -> MagicMock:
    client = MagicMock(name="supabase")
    client.storage.from_.return_value.download.return_value = jpeg()
    results = {
        "complete_model_job": [{"discard": False, "old_path": None}],
        "fail_model_job": None,
    }

    def rpc(name: str, params: dict[str, Any]):
        call = MagicMock()
        call.execute.return_value = MagicMock(data=results.get(name))
        return call

    client.rpc.side_effect = rpc
    return client


def rpc_calls(sb: MagicMock, name: str) -> list[dict[str, Any]]:
    return [c.args[1] for c in sb.rpc.call_args_list if c.args[0] == name]


# --- profile selection -------------------------------------------------------


def test_default_profile_is_emi_and_keeps_emi_rpc_names():
    profile = get_profile(EMI_PROFILE)
    assert profile.claim_rpc == "claim_model_conversion"
    assert profile.complete_rpc == "complete_model_conversion"
    assert profile.photo_linked is True


def test_sketch_profile_uses_model_jobs_rpcs_and_sketch_bucket():
    profile = get_profile(SKETCH_PROFILE)
    assert profile.claim_rpc == "claim_model_job"
    assert profile.stale_rpc == "fail_stale_model_jobs"
    assert profile.complete_rpc == "complete_model_job"
    assert profile.fail_rpc == "fail_model_job"
    assert profile.input_bucket == profile.model_bucket == "sketch-runner"
    assert profile.photo_linked is False


def test_unknown_profile_is_rejected_with_the_allowed_names():
    with pytest.raises(ValueError, match="QUEUE_MODE must be one of: emi, sketch"):
        get_profile("other")


# --- configuration -------------------------------------------------------------


@pytest.fixture
def clean_env(monkeypatch):
    monkeypatch.setattr(config_module, "load_dotenv", lambda: None)
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "QUEUE_MODE"):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_queue_mode_defaults_to_emi(clean_env):
    clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
    clean_env.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    assert load_config().queue_mode == "emi"


def test_queue_mode_sketch_and_secret_key_fallback(clean_env):
    clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
    clean_env.setenv("SUPABASE_SECRET_KEY", "sb_secret_value")
    clean_env.setenv("QUEUE_MODE", "sketch")
    cfg = load_config()
    assert cfg.queue_mode == "sketch"
    assert cfg.service_role_key == "sb_secret_value"


def test_missing_key_still_names_the_service_role_variable(clean_env):
    clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
    with pytest.raises(ValueError, match="SUPABASE_SERVICE_ROLE_KEY"):
        load_config()


# --- running a sketch job --------------------------------------------------------


def test_sketch_job_reads_its_input_key_and_writes_the_model_to_the_sketch_bucket(sb):
    generate = MagicMock(return_value=b"glb")
    run_job(sb, CFG, sketch_job(), generate=generate, profile=get_profile(SKETCH_PROFILE))

    sb.table.assert_not_called()  # no photos lookup for sketches
    sb.storage.from_.assert_any_call("sketch-runner")
    sb.storage.from_.return_value.download.assert_called_once_with(
        "inputs/11111111-1111-4111-8111-111111111111.jpg"
    )
    sb.storage.from_.return_value.upload.assert_called_once_with(
        "models/job-1.glb", b"glb", {"content-type": "model/gltf-binary", "upsert": "false"}
    )
    assert rpc_calls(sb, "complete_model_job") == [
        {"p_job_id": "job-1", "p_path": "models/job-1.glb", "p_size": 3}
    ]


def test_sketch_job_failure_is_recorded_with_fail_model_job(sb):
    generate = MagicMock(side_effect=RuntimeError("upstream exploded"))
    run_job(sb, CFG, sketch_job(), generate=generate, profile=get_profile(SKETCH_PROFILE))

    failed = rpc_calls(sb, "fail_model_job")
    assert len(failed) == 1
    assert failed[0]["p_job_id"] == "job-1"
    assert "upstream exploded" not in failed[0]["p_message"]


def test_emi_profile_is_still_the_default_for_run_job(sb):
    row = {
        "id": "job-9",
        "owner_id": "owner-1",
        "photo_id": "photo-1",
        "seed": 0,
        "settings": dict(SETTINGS),
        "requested_at": datetime.now(UTC).isoformat(),
    }
    maybe_single = sb.table.return_value.select.return_value.eq.return_value.maybe_single
    maybe_single.return_value.execute.return_value = MagicMock(
        data={"storage_path": "owner-1/photo-1/original", "deleted_at": None}
    )
    run_job(sb, CFG, row, generate=MagicMock(return_value=b"glb"))
    assert (
        rpc_calls(sb, "complete_model_conversion")[0]["p_path"] == "owner-1/photo-1/model-job-9.glb"
    )


# --- the poll cycle --------------------------------------------------------------


def test_cycle_uses_the_sketch_rpcs_and_does_not_read_photo_id(monkeypatch):
    client = MagicMock(name="supabase")
    calls: list[str] = []

    def rpc(name: str, params: dict[str, Any]):
        calls.append(name)
        call = MagicMock()
        if name == "claim_model_job":
            call.execute.return_value = MagicMock(data=sketch_job())
        else:
            call.execute.return_value = MagicMock(data=0)
        return call

    client.rpc.side_effect = rpc
    run = MagicMock()
    monkeypatch.setattr(main_module, "run_job", run)
    cfg = Config(
        supabase_url="u",
        service_role_key="k",
        sf3d_api_url="https://space.test/generate-3d/",
        worker_id="w1",
        queue_mode="sketch",
    )

    assert main_module.run_cycle(client, cfg) is True
    assert calls[:2] == ["fail_stale_model_jobs", "claim_model_job"]
    assert run.call_args.args[1].queue_mode == "sketch"
