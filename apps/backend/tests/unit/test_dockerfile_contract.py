from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = BACKEND_ROOT / "Dockerfile"


def test_dockerfile_has_required_python_runtime_contract() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "ARG PYTHON_IMAGE=python:3.13.14-slim-bookworm" in dockerfile
    assert "PYTHONDONTWRITEBYTECODE=1" in dockerfile
    assert "PYTHONUNBUFFERED=1" in dockerfile
    assert "UV_PYTHON_DOWNLOADS=never" in dockerfile
    assert "LANGSMITH_TRACING=false" in dockerfile
    assert "PYTHONPATH=/app/src" in dockerfile
    assert "assert sys.version_info[:2] == (3, 13)" in dockerfile


def test_dockerfile_uses_frozen_uv_lock_without_dev_dependencies() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.11.28" in dockerfile
    assert "COPY apps/backend/pyproject.toml apps/backend/uv.lock ./" in dockerfile
    assert "uv sync --locked --no-dev --no-install-project" in dockerfile
    assert "uv sync --locked --no-dev --compile-bytecode" in dockerfile
    assert "--frozen" not in dockerfile


def test_dockerfile_has_non_root_runtime_and_init() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "apt-get install -y --no-install-recommends ca-certificates tini" in dockerfile
    assert "useradd" in dockerfile
    assert "USER silo" in dockerfile
    assert 'ENTRYPOINT ["/usr/bin/tini", "--"]' in dockerfile


def test_dockerfile_declares_api_and_worker_targets() -> None:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert "FROM runtime AS api" in dockerfile
    assert "COPY apps/backend/alembic.ini ./" in dockerfile
    assert "COPY apps/backend/migrations ./migrations" in dockerfile
    assert (
        'CMD ["uvicorn", "silo.api.main:app", "--host", "0.0.0.0", "--port", "4001"]' in dockerfile
    )
    assert "FROM runtime AS worker" in dockerfile
    assert 'CMD ["python", "-m", "silo.worker.main"]' in dockerfile
