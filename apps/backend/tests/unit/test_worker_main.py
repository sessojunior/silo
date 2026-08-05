from __future__ import annotations

import importlib
from types import SimpleNamespace

import pytest

worker_main = importlib.import_module("silo.worker.main")


def test_worker_main_parse_args_handles_topic_and_validation() -> None:
    args = worker_main._parse_args(["model.status", "--validation"])  # noqa: SLF001

    assert args.topic == "model.status"
    assert args.validation is True


@pytest.mark.asyncio
async def test_worker_run_uses_validation_settings_and_runs_consumer(monkeypatch: pytest.MonkeyPatch) -> None:
    base_settings = SimpleNamespace(name="base")
    validation_settings = SimpleNamespace(name="validation")
    shutdown_state = SimpleNamespace()
    calls: list[tuple[str, object]] = []

    monkeypatch.setattr(worker_main, "load_worker_settings", lambda: base_settings)
    monkeypatch.setattr(
        worker_main,
        "build_validation_settings",
        lambda settings: calls.append(("validation", settings)) or validation_settings,
    )
    monkeypatch.setattr(worker_main, "create_shutdown_state", lambda: shutdown_state)
    monkeypatch.setattr(
        worker_main,
        "install_shutdown_handlers",
        lambda state: calls.append(("handlers", state)) or (lambda: calls.append(("remove", None))),
    )

    async def fake_run_consumer(settings, *, shutdown_state, cli_topic):
        calls.append(("consumer", settings, shutdown_state, cli_topic))

    monkeypatch.setattr(worker_main, "run_consumer", fake_run_consumer)

    result = await worker_main._run(["model.status", "--validation"])  # noqa: SLF001

    assert result == 0
    assert calls[0] == ("validation", base_settings)
    assert calls[1] == ("handlers", shutdown_state)
    assert calls[2] == ("consumer", validation_settings, shutdown_state, "model.status")
    assert calls[3] == ("remove", None)


def test_worker_main_main_delegates_to_asyncio_run(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded = {}

    def fake_run(coro):
        coro.close()
        recorded["coro_name"] = coro.cr_code.co_name
        return 17

    monkeypatch.setattr(worker_main.logging, "basicConfig", lambda **kwargs: recorded.update(kwargs))
    monkeypatch.setattr(worker_main.asyncio, "run", fake_run)

    assert worker_main.main(["model.status"]) == 17
    assert recorded["level"] == worker_main.logging.INFO
    assert recorded["coro_name"] == "_run"
