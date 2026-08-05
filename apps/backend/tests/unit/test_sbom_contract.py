from __future__ import annotations

from pathlib import Path

import json

from silo.security.sbom_contract import build_service_scope_sboms, load_uv_lock


def _write_lock(path: Path) -> None:
    path.write_text(
        """
[[package]]
name = "silo-backend"
version = "0.0.0"
dependencies = ["langgraph>=1.2.9", "worker-helper>=1.0.0"]

[[package]]
name = "langgraph"
version = "1.2.9"
dependencies = ["langchain-core>=1.4.9"]

[[package]]
name = "langchain-core"
version = "1.4.9"
dependencies = []

[[package]]
name = "worker-helper"
version = "1.0.0"
dependencies = ["shared-lib>=2.0.0"]

[[package]]
name = "shared-lib"
version = "2.0.0"
dependencies = []
""".strip(),
        encoding="utf-8",
    )


def test_load_uv_lock_parses_dependency_graph(tmp_path: Path) -> None:
    lock_path = tmp_path / "uv.lock"
    _write_lock(lock_path)

    packages = load_uv_lock(lock_path)

    assert packages["langgraph"].dependencies == ("langchain-core",)
    assert packages["silo-backend"].dependencies == ("langgraph", "worker-helper")


def test_build_service_scope_sboms_separates_ai_stack_from_worker_stack(tmp_path: Path) -> None:
    lock_path = tmp_path / "uv.lock"
    _write_lock(lock_path)
    output_dir = tmp_path / "sbom"

    paths = build_service_scope_sboms(lock_path, output_dir)

    api_bom = json.loads(paths["api"].read_text(encoding="utf-8"))
    worker_bom = json.loads(paths["worker"].read_text(encoding="utf-8"))
    summary = json.loads(paths["summary"].read_text(encoding="utf-8"))

    api_names = {component["name"] for component in api_bom["components"]}
    worker_names = {component["name"] for component in worker_bom["components"]}

    assert api_names == {"langchain-core", "langgraph"}
    assert worker_names == {"shared-lib", "silo-backend", "worker-helper"}
    assert summary["apiPackageCount"] == 2
    assert summary["workerPackageCount"] == 3
    assert summary["apiPackages"][0]["name"] == "langchain-core"
    assert summary["workerPackages"][0]["name"] == "shared-lib"
    assert api_bom["metadata"]["properties"][0]["value"] == "api"
    assert worker_bom["metadata"]["properties"][0]["value"] == "worker"
    assert "langgraph" in json.dumps(api_bom, ensure_ascii=False)
    assert "langgraph" not in json.dumps(worker_bom, ensure_ascii=False)
