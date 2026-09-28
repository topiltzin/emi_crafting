from __future__ import annotations

import io
import time
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest
from PIL import Image

from trellis_worker import job_runner
from trellis_worker.config import Config
from trellis_worker.errors import USER_MESSAGES, ConversionError
from trellis_worker.job_runner import MAX_MODEL_BYTES, monotonic_deadline, run_job

CFG = Config(supabase_url="u", service_role_key="k", stability_api_key="sk-x", worker_id="w1")
PATH = "owner-1/photo-1/model-job-1.glb"


def jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "red").save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def sb(fake_supabase):
    photo_resp = MagicMock(data={"storage_path": "owner-1/photo-1/original", "deleted_at": None})
    (
        fake_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value
    ) = photo_resp
    fake_supabase.storage.from_.return_value.download.return_value = jpeg()
    fake_supabase._rpc_results = {
        "complete_model_conversion": [{"discard": False, "old_path": None}],
        "fail_model_conversion": None,
    }

    def rpc(name: str, params: dict[str, Any]):
        call = MagicMock()
        call.execute.return_value = MagicMock(data=fake_supabase._rpc_results.get(name))
        return call

    fake_supabase.rpc.side_effect = rpc
    return fake_supabase


def rpc_calls(sb, name):
    return [c.args[1] for c in sb.rpc.call_args_list if c.args[0] == name]


def bucket(sb):
    return sb.storage.from_.return_value


def fresh_job(job_row, **kw):
    return job_row(requested_at=datetime.now(UTC).isoformat(), **kw)


def test_happy_path(sb, job_row):
    generate = MagicMock(return_value=b"glb")
    run_job(sb, CFG, fresh_job(job_row, seed=7), generate=generate)

    sb.storage.from_.assert_called_with("photos")
    bucket(sb).download.assert_called_once_with("owner-1/photo-1/original")
    args, kwargs = generate.call_args
    assert args[1] == 7
    assert kwargs["api_key"] == "sk-x"
    assert kwargs["deadline"] > time.monotonic() + 590

    bucket(sb).upload.assert_called_once_with(
        PATH, b"glb", {"content-type": "model/gltf-binary", "upsert": "false"}
    )
    assert rpc_calls(sb, "complete_model_conversion") == [
        {"p_job_id": "job-1", "p_path": PATH, "p_size": 3}
    ]
    bucket(sb).remove.assert_not_called()
    assert rpc_calls(sb, "fail_model_conversion") == []


def test_redo_removes_old_model_after_completion(sb, job_row):
    old = "owner-1/photo-1/model-old.glb"
    sb._rpc_results["complete_model_conversion"] = [{"discard": False, "old_path": old}]
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(return_value=b"glb"))
    bucket(sb).remove.assert_called_once_with([old])


def test_discard_removes_uploaded_file(sb, job_row):
    sb._rpc_results["complete_model_conversion"] = [{"discard": True, "old_path": None}]
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(return_value=b"glb"))
    bucket(sb).remove.assert_called_once_with([PATH])
    assert rpc_calls(sb, "fail_model_conversion") == []


def test_empty_complete_result_treated_as_discard(sb, job_row):
    sb._rpc_results["complete_model_conversion"] = []
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(return_value=b"glb"))
    bucket(sb).remove.assert_called_once_with([PATH])


def test_hard_deleted_photo_is_skipped(sb, job_row):
    chain = sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value
    chain.execute.return_value = None
    generate = MagicMock()
    run_job(sb, CFG, fresh_job(job_row), generate=generate)
    generate.assert_not_called()
    assert sb.rpc.call_args_list == []


def test_generation_error_is_recorded_without_upload(sb, job_row):
    generate = MagicMock(side_effect=ConversionError("SERVICE_QUOTA"))
    run_job(sb, CFG, fresh_job(job_row), generate=generate)
    bucket(sb).upload.assert_not_called()
    assert rpc_calls(sb, "fail_model_conversion") == [
        {
            "p_job_id": "job-1",
            "p_code": "SERVICE_QUOTA",
            "p_message": USER_MESSAGES["SERVICE_QUOTA"],
        }
    ]


def test_unexpected_error_message_is_generic(sb, job_row):
    generate = MagicMock(side_effect=RuntimeError("Traceback with hf_secret"))
    run_job(sb, CFG, fresh_job(job_row), generate=generate)
    (call,) = rpc_calls(sb, "fail_model_conversion")
    assert call["p_code"] == "INTERNAL"
    assert "hf_secret" not in call["p_message"]


def test_too_large_result(sb, job_row, monkeypatch):
    monkeypatch.setattr(job_runner, "MAX_MODEL_BYTES", 2)
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(return_value=b"glb"))
    bucket(sb).upload.assert_not_called()
    assert rpc_calls(sb, "fail_model_conversion")[0]["p_code"] == "RESULT_TOO_LARGE"


def test_limit_is_50mb():
    assert MAX_MODEL_BYTES == 52_428_800


def test_failure_after_upload_removes_upload(sb, job_row):
    def rpc(name, params):
        if name == "complete_model_conversion":
            raise ConnectionError("db down")
        call = MagicMock()
        call.execute.return_value = MagicMock(data=None)
        return call

    sb.rpc.side_effect = rpc
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(return_value=b"glb"))
    bucket(sb).remove.assert_called_once_with([PATH])


def test_invalid_original(sb, job_row):
    bucket(sb).download.return_value = b"garbage"
    generate = MagicMock()
    run_job(sb, CFG, fresh_job(job_row), generate=generate)
    generate.assert_not_called()
    assert rpc_calls(sb, "fail_model_conversion")[0]["p_code"] == "INVALID_IMAGE"


def test_invalid_settings(sb, job_row):
    run_job(sb, CFG, fresh_job(job_row, settings={"resolution": "1024"}), generate=MagicMock())
    assert rpc_calls(sb, "fail_model_conversion")[0]["p_code"] == "INTERNAL"


def test_recording_failure_error_is_swallowed(sb, job_row):
    def rpc(name, params):
        raise ConnectionError("db down")

    sb.rpc.side_effect = rpc
    run_job(sb, CFG, fresh_job(job_row), generate=MagicMock(side_effect=TimeoutError()))


def test_monotonic_deadline_from_requested_at():
    now = datetime(2026, 9, 27, 10, 5, tzinfo=UTC)
    requested = (now - timedelta(minutes=5)).isoformat().replace("+00:00", "Z")
    remaining = monotonic_deadline(requested, now=now) - time.monotonic()
    assert 299 <= remaining <= 300


def test_monotonic_deadline_naive_timestamp_is_utc():
    now = datetime(2026, 9, 27, 10, 0, tzinfo=UTC)
    remaining = monotonic_deadline("2026-09-27T10:00:00", now=now) - time.monotonic()
    assert 599 <= remaining <= 600
