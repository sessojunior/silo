from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from silo.worker.config import DEFAULT_HEALTH_STALE_SECONDS, DEFAULT_HEALTH_STATE_PATH
from silo.worker.health import evaluate_worker_health, load_worker_health_state


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Valida o heartbeat interno do worker Python.")
    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path(os.environ.get("WORKER_HEALTH_STATE_PATH", str(DEFAULT_HEALTH_STATE_PATH))),
        help="Arquivo JSON de heartbeat gerado pelo worker.",
    )
    parser.add_argument(
        "--stale-after-seconds",
        type=float,
        default=float(os.environ.get("WORKER_HEALTH_STALE_SECONDS", DEFAULT_HEALTH_STALE_SECONDS)),
        help="Janela maxima de inatividade aceitavel.",
    )
    return parser.parse_args(sys.argv[1:] if argv is None else argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    payload = load_worker_health_state(args.state_file)
    if evaluate_worker_health(payload, stale_seconds=args.stale_after_seconds):
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
