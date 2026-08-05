from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
GITHUB_CI = REPOSITORY_ROOT / ".github" / "workflows" / "ci.yml"
GITLAB_CI = REPOSITORY_ROOT / ".gitlab-ci.yml"
README = REPOSITORY_ROOT / "README.md"
BACKEND_PYPROJECT = REPOSITORY_ROOT / "apps" / "backend" / "pyproject.toml"
DEPLOY_COMPOSE = REPOSITORY_ROOT / "docker-compose.deploy.yml"
DEPLOY_SCRIPT = REPOSITORY_ROOT / "scripts" / "gitlab" / "deploy.sh"


def test_github_actions_has_explicit_node_python_and_windows_jobs_without_turbo() -> None:
    workflow = GITHUB_CI.read_text(encoding="utf-8")

    assert "windows-latest" in workflow
    assert "  node:" in workflow
    assert "  python:" in workflow
    assert "npx turbo" not in workflow
    assert "working-directory: apps/frontend" in workflow
    assert "node scripts/security/check-node-audit.mjs" in workflow
    assert "uv --directory apps/backend run --locked pytest" in workflow
    assert "uv --directory apps/backend run --locked python scripts/check_coverage_thresholds.py" in workflow
    assert "uv --directory apps/backend audit --locked --no-dev" in workflow
    assert "npm run typecheck" in workflow
    assert "npm run lint" in workflow
    assert "npm run build" in workflow
    assert "uv --directory apps/backend sync --locked --all-groups" in workflow
    assert "Web E2E" not in workflow


def test_gitlab_ci_has_explicit_node_python_and_backend_image_jobs_without_turbo() -> None:
    pipeline = GITLAB_CI.read_text(encoding="utf-8")

    assert "validate:node:" in pipeline
    assert "validate:python:" in pipeline
    assert "validate:web:" not in pipeline
    assert "security:scan:" in pipeline
    assert "--target api" in pipeline
    assert "npx turbo" not in pipeline
    assert "npm run lint" in pipeline
    assert "npm run typecheck" in pipeline
    assert "uv --directory apps/backend sync --locked --all-groups" in pipeline
    assert "uv --directory apps/backend run --locked ruff format --check" in pipeline
    assert "uv --directory apps/backend run --locked mypy src" in pipeline
    assert "uv --directory apps/backend run --locked pytest" in pipeline
    assert "uv --directory apps/backend run --locked python scripts/check_coverage_thresholds.py" in pipeline
    assert "uv --directory apps/backend run --locked silo-openapi-export --check" in pipeline
    assert "node scripts/security/check-node-audit.mjs" in pipeline
    assert "uv --directory apps/backend audit --locked --no-dev" in pipeline


def test_readme_documents_essential_commands() -> None:
    readme = README.read_text(encoding="utf-8")

    assert "cd apps/frontend" in readme
    assert "npm run dev" in readme
    assert "npm run build" in readme
    assert "npm test" in readme
    assert "cd apps/backend" in readme
    assert "uv sync --locked --all-groups" in readme
    assert "uv run --locked pytest -q" in readme
    assert "uv run --locked ruff format --check" in readme
    assert "uv run --locked ruff check" in readme
    assert "node scripts/security/check-node-audit.mjs" in readme
    assert "node scripts/security/generate-sbom.mjs" in readme
    assert "node scripts/load/run-http-benchmark.mjs" in readme
    assert "node scripts/deploy/cutover-runbook.mjs" in readme
    assert "docker compose up -d --build" in readme


def test_backend_pyproject_exposes_observability_and_sbom_scripts() -> None:
    pyproject = BACKEND_PYPROJECT.read_text(encoding="utf-8")

    assert 'silo-ai-observability-contract = "silo.ai.observability_contract:main"' in pyproject
    assert 'silo-sbom-contract = "silo.security.sbom_contract:main"' in pyproject


def test_deploy_compose_and_script_exist_for_gitlab_release_flow() -> None:
    compose = DEPLOY_COMPOSE.read_text(encoding="utf-8")
    script = DEPLOY_SCRIPT.read_text(encoding="utf-8")

    assert "SILO_IMAGE" in compose
    assert "container_name: silo-api-python" in compose
    assert "container_name: silo-worker-python" in compose
    assert 'command: ["python", "-m", "silo.worker.main"]' in compose
    assert 'command: ["python", "-m", "silo.ai.ollama_init"]' in compose
    assert "docker compose -f \"$DEPLOY_COMPOSE_FILE\" up -d --remove-orphans --wait --wait-timeout 300" in script
    assert "docker compose -f \"$DEPLOY_COMPOSE_FILE\" exec -T api python -c" in script
    assert "docker compose -f \"$DEPLOY_COMPOSE_FILE\" exec -T worker python -m silo.worker.healthcheck" in script
