from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
API_DIR = REPOSITORY_ROOT / "apps/api"
WORKER_DIR = REPOSITORY_ROOT / "apps/worker"
LEGACY_DB_DIR = REPOSITORY_ROOT / "packages/db"
ENTRYPOINT = REPOSITORY_ROOT / "entrypoint-api.sh"
API_DOCKERFILE = REPOSITORY_ROOT / "apps/api/Dockerfile"
WORKER_DOCKERFILE = REPOSITORY_ROOT / "apps/worker/Dockerfile"
COMPOSE = REPOSITORY_ROOT / "docker-compose.yml"


def test_legacy_node_trees_and_entrypoint_are_removed() -> None:
    assert not API_DIR.exists()
    assert not WORKER_DIR.exists()
    assert not LEGACY_DB_DIR.exists()
    assert not ENTRYPOINT.exists()
    assert not API_DOCKERFILE.exists()
    assert not WORKER_DOCKERFILE.exists()


def test_final_compose_uses_python_targets_and_no_longer_exposes_node_skip_flags() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")

    assert "target: api" in compose
    assert "target: worker" in compose
    assert "command: [\"uvicorn\", \"silo.api.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"4000\"]" in compose
    assert "SKIP_DB_SYNC" not in compose
    assert "SKIP_DB_SEED" not in compose
