from __future__ import annotations

import re
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
API_DIR = REPOSITORY_ROOT / "apps/api"
WORKER_DIR = REPOSITORY_ROOT / "apps/worker"
LEGACY_DB_DIR = REPOSITORY_ROOT / "packages/db"
ENTRYPOINT = REPOSITORY_ROOT / "entrypoint-api.sh"
API_DOCKERFILE = REPOSITORY_ROOT / "apps/api/Dockerfile"
WORKER_DOCKERFILE = REPOSITORY_ROOT / "apps/worker/Dockerfile"
COMPOSE = REPOSITORY_ROOT / "docker-compose.yml"


def _service_block(compose: str, service_name: str) -> str:
    match = re.search(
        rf"^  {re.escape(service_name)}:\n(?P<body>.*?)(?=^  [A-Za-z0-9_-]+:\n|\Z)",
        compose,
        re.MULTILINE | re.DOTALL,
    )
    assert match is not None, f"service {service_name!r} not found"
    return match.group("body")


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
    assert (
        'command: ["uvicorn", "silo.api.main:app", "--host", "0.0.0.0", "--port", "4000"]'
        in compose
    )
    assert "SKIP_DB_SYNC" not in compose
    assert "SKIP_DB_SEED" not in compose


def test_compose_uses_the_768_dimension_embedding_service_for_api_and_vllm_embed() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")
    api = _service_block(compose, "api")
    embedding = _service_block(compose, "vllm-embed")

    assert "VLLM_EMBEDDING_MODEL: ${VLLM_EMBEDDING_MODEL:-BAAI/bge-base-en-v1.5}" in api
    assert "VLLM_EMBEDDING_URL: http://vllm-embed:8000/v1" in api
    assert '"${VLLM_EMBEDDING_MODEL:-BAAI/bge-base-en-v1.5}"' in embedding


def test_deploy_compose_keeps_the_dedicated_embedding_service_contract() -> None:
    deploy_compose = (REPOSITORY_ROOT / "docker-compose.deploy.yml").read_text(encoding="utf-8")

    assert "VLLM_EMBEDDING_MODEL: ${VLLM_EMBEDDING_MODEL:-BAAI/bge-base-en-v1.5}" in deploy_compose
    assert "VLLM_EMBEDDING_URL: http://vllm-embed:8000/v1" in deploy_compose


def test_development_compose_declares_bounded_cpu_inference_resources() -> None:
    compose = COMPOSE.read_text(encoding="utf-8")
    vllm = _service_block(compose, "vllm")
    embedding = _service_block(compose, "vllm-embed")

    assert "image: ${SILO_VLLM_CPU_IMAGE:-vllm/vllm-openai-cpu:v0.29.0-x86_64}" in vllm
    assert "SILO_VLLM_IMAGE" not in vllm
    assert 'mem_limit: "8g"' in vllm
    assert 'cpus: "6.0"' in vllm
    assert 'mem_limit: "4g"' in embedding
    assert 'cpus: "2.0"' in embedding
    assert "    deploy:" not in vllm
    assert "    deploy:" not in embedding


def test_deploy_compose_declares_shared_or_separate_gpu_device_selection() -> None:
    deploy_compose = (REPOSITORY_ROOT / "docker-compose.deploy.yml").read_text(encoding="utf-8")
    vllm = _service_block(deploy_compose, "vllm")
    embedding = _service_block(deploy_compose, "vllm-embed")

    assert "image: ${SILO_VLLM_GPU_IMAGE:-vllm/vllm-openai:v0.29.0}" in vllm
    assert "image: ${SILO_VLLM_GPU_IMAGE:-vllm/vllm-openai:v0.29.0}" in embedding
    assert 'device_ids: ["${SILO_VLLM_GPU_ID:-0}"]' in vllm
    assert 'device_ids: ["${SILO_VLLM_EMBED_GPU_ID:-0}"]' in embedding
    assert "capabilities: [gpu]" in vllm
    assert "capabilities: [gpu]" in embedding
    assert 'mem_limit: "8g"' in vllm
    assert 'mem_limit: "4g"' in embedding
    assert "SILO_VLLM_EMBED_GPU_ID=1" in (
        (REPOSITORY_ROOT / "deploy.txt").read_text(encoding="utf-8")
    )


def test_deploy_compose_uses_separate_gpu_memory_budgets() -> None:
    deploy_compose = (REPOSITORY_ROOT / "docker-compose.deploy.yml").read_text(encoding="utf-8")
    vllm = _service_block(deploy_compose, "vllm")
    embedding = _service_block(deploy_compose, "vllm-embed")

    assert '"${SILO_VLLM_GPU_MEM_UTIL:-0.70}"' in vllm
    assert '"${SILO_VLLM_EMBED_GPU_MEM_UTIL:-0.20}"' in embedding
    assert "SILO_VLLM_EMBED_GPU_MEM_UTIL=0.85" in (
        (REPOSITORY_ROOT / "deploy.txt").read_text(encoding="utf-8")
    )
