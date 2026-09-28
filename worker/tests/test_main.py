from __future__ import annotations

import threading
from typing import Any
from unittest.mock import MagicMock

import pytest

from trellis_worker import __main__ as main_module
from trellis_worker.config import Config

CFG = Config(
    supabase_url="u",
    service_role_key="k",
    stability_api_key="sk-t",
    poll_seconds=0.01,
    worker_id="w1",
)


def make_sb(claims: list[Any]):
    sb = MagicMock()
    queue = list(claims)

    def rpc(name, params):
        call = MagicMock()
        if name == "claim_model_conversion":
            assert params == {"p_worker_id": "w1"}
            data = queue.pop(0) if queue else {"id": None}
        else:
            data = 0
        call.execute.return_value = MagicMock(data=data)
        return call

    sb.rpc.side_effect = rpc
    return sb


def test_cycle_claims_and_runs(monkeypatch):
    run_job = MagicMock()
    monkeypatch.setattr(main_module, "run_job", run_job)
    job = {"id": "job-1", "photo_id": "p"}
    sb = make_sb([job])
    assert main_module.run_cycle(sb, CFG) is True
    run_job.assert_called_once_with(sb, CFG, job)
    names = [c.args[0] for c in sb.rpc.call_args_list]
    assert names == ["fail_stale_model_conversions", "claim_model_conversion"]


@pytest.mark.parametrize("empty", [{"id": None}, None, [], [{"id": None}]])
def test_cycle_empty_queue(monkeypatch, empty):
    run_job = MagicMock()
    monkeypatch.setattr(main_module, "run_job", run_job)
    assert main_module.run_cycle(make_sb([empty]), CFG) is False
    run_job.assert_not_called()


def test_claim_list_shape(monkeypatch):
    sb = make_sb([[{"id": "job-2", "photo_id": "p"}]])
    assert main_module.claim_next(sb, "w1") == {"id": "job-2", "photo_id": "p"}


def test_run_forever_survives_errors_and_stops(monkeypatch):
    stop = threading.Event()
    calls = {"n": 0}

    def cycle(sb, cfg):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("transient")
        if calls["n"] == 2:
            return True
        stop.set()
        return False

    monkeypatch.setattr(main_module, "run_cycle", cycle)
    main_module.run_forever(MagicMock(), CFG, stop)
    assert calls["n"] == 3


def test_main_missing_config(monkeypatch):
    monkeypatch.setattr(main_module, "load_config", MagicMock(side_effect=ValueError("Missing")))
    assert main_module.main() == 2


def test_main_bad_api_key_exits_nonzero(monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: CFG)
    monkeypatch.setattr("supabase.create_client", MagicMock())
    monkeypatch.setattr(main_module, "check_api", MagicMock(side_effect=RuntimeError("missing")))
    assert main_module.main() == 1


def test_main_runs_loop(monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: CFG)
    monkeypatch.setattr("supabase.create_client", MagicMock())
    monkeypatch.setattr(main_module, "check_api", MagicMock())
    run_forever = MagicMock()
    monkeypatch.setattr(main_module, "run_forever", run_forever)
    monkeypatch.setattr(main_module.signal, "signal", MagicMock())
    assert main_module.main() == 0
    run_forever.assert_called_once()
