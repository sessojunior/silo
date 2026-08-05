from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from collections.abc import Sequence

from silo.worker.config import build_validation_settings, load_worker_settings
from silo.worker.consumer import create_shutdown_state, install_shutdown_handlers, run_consumer


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inicia o worker Kafka Python do SILO.")
    parser.add_argument("topic", nargs="?", default=None, help="Topico Kafka opcional")
    parser.add_argument(
        "--validation",
        action="store_true",
        help="Isola o group id e o arquivo de health para uma execucao de validacao.",
    )
    return parser.parse_args(list(argv) if argv is not None else sys.argv[1:])


async def _run(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    settings = load_worker_settings()
    if args.validation:
        settings = build_validation_settings(settings)
    shutdown_state = create_shutdown_state()
    remove_handlers = install_shutdown_handlers(shutdown_state)
    try:
        await run_consumer(
            settings,
            shutdown_state=shutdown_state,
            cli_topic=args.topic,
        )
    finally:
        remove_handlers()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO)
    return asyncio.run(_run(argv))


if __name__ == "__main__":
    raise SystemExit(main())
