from __future__ import annotations

import argparse
import json
import re
import tomllib
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib import metadata
from pathlib import Path
from typing import Any

AI_ROOT_PACKAGES: tuple[str, ...] = (
    "langchain-core",
    "langgraph",
    "langchain-protocol",
    "langgraph-checkpoint",
    "langgraph-prebuilt",
    "langgraph-sdk",
)

DEPENDENCY_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+")


@dataclass(frozen=True, slots=True)
class PackageRecord:
    name: str
    version: str
    dependencies: tuple[str, ...]
    license_name: str | None = None

    @property
    def bom_ref(self) -> str:
        return f"{self.name}@{self.version}"


def load_uv_lock(lock_path: Path) -> dict[str, PackageRecord]:
    payload = tomllib.loads(lock_path.read_text(encoding="utf-8"))
    packages = payload.get("package", [])
    if not isinstance(packages, list):
        raise ValueError("uv.lock inválido: lista de packages ausente.")

    package_index: dict[str, PackageRecord] = {}
    for raw_package in packages:
        if not isinstance(raw_package, dict):
            continue

        name = _optional_text(raw_package.get("name"))
        version = _optional_text(raw_package.get("version"))
        if name is None or version is None:
            continue

        dependencies = tuple(
            sorted(
                {
                    dependency_name
                    for dependency_name in (
                        _dependency_name(dependency)
                        for dependency in (raw_package.get("dependencies") or [])
                    )
                    if dependency_name is not None
                }
            )
        )
        package_index[name] = PackageRecord(
            name=name,
            version=version,
            dependencies=dependencies,
            license_name=_load_license(name),
        )

    return package_index


def build_service_scope_sboms(
    lock_path: Path,
    output_dir: Path,
) -> dict[str, Path]:
    packages = load_uv_lock(lock_path)
    ai_package_names = _transitive_closure(packages, AI_ROOT_PACKAGES)
    worker_package_names = set(packages) - ai_package_names

    output_dir.mkdir(parents=True, exist_ok=True)
    api_path = output_dir / "python.api.cdx.json"
    worker_path = output_dir / "python.worker.cdx.json"
    summary_path = output_dir / "python.service-scopes.json"

    api_bom = _build_cyclonedx_bom(
        scope="api",
        packages=packages,
        package_names=ai_package_names,
        lock_path=lock_path,
    )
    worker_bom = _build_cyclonedx_bom(
        scope="worker",
        packages=packages,
        package_names=worker_package_names,
        lock_path=lock_path,
    )
    summary = {
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "lockFile": lock_path.as_posix(),
        "aiRootPackages": list(AI_ROOT_PACKAGES),
        "apiPackageCount": len(ai_package_names),
        "workerPackageCount": len(worker_package_names),
        "apiPackages": _serialize_package_list(packages, ai_package_names),
        "workerPackages": _serialize_package_list(packages, worker_package_names),
        "apiLicenseSummary": _license_summary(packages, ai_package_names),
        "workerLicenseSummary": _license_summary(packages, worker_package_names),
    }

    api_path.write_text(
        json.dumps(api_bom, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    worker_path.write_text(
        json.dumps(worker_bom, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    return {"api": api_path, "worker": worker_path, "summary": summary_path}


def main(argv: list[str] | None = None) -> int:
    repo_root = Path(__file__).resolve().parents[5]
    default_lock = repo_root / "apps" / "backend" / "uv.lock"
    default_output = repo_root / "artifacts" / "sbom"

    parser = argparse.ArgumentParser(description="Gera SBOMs separados por escopo de serviço.")
    parser.add_argument("--lock-file", default=str(default_lock))
    parser.add_argument("--output-dir", default=str(default_output))
    args = parser.parse_args(argv)

    paths = build_service_scope_sboms(Path(args.lock_file), Path(args.output_dir))
    print(paths["api"].as_posix())
    print(paths["worker"].as_posix())
    print(paths["summary"].as_posix())
    return 0


def _build_cyclonedx_bom(
    *,
    scope: str,
    packages: dict[str, PackageRecord],
    package_names: set[str],
    lock_path: Path,
) -> dict[str, Any]:
    components = [
        _serialize_component(packages[name])
        for name in sorted(package_names)
        if name in packages
    ]
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "component": {
                "bom-ref": f"silo-backend-{scope}",
                "type": "application",
                "name": "silo-backend",
                "version": "workspace-lock",
            },
            "properties": [
                {"name": "scope", "value": scope},
                {"name": "lockFile", "value": lock_path.as_posix()},
                {"name": "packageCount", "value": str(len(components))},
            ],
        },
        "components": components,
    }


def _serialize_component(package: PackageRecord) -> dict[str, Any]:
    component: dict[str, Any] = {
        "bom-ref": package.bom_ref,
        "type": "library",
        "name": package.name,
        "version": package.version,
    }
    if package.license_name:
        component["licenses"] = [{"license": {"name": package.license_name}}]
    return component


def _serialize_package_list(
    packages: dict[str, PackageRecord],
    package_names: set[str],
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for name in sorted(package_names):
        package = packages.get(name)
        if package is None:
            continue
        items.append(
            {
                "name": package.name,
                "version": package.version,
                "license": package.license_name,
            }
        )
    return items


def _license_summary(
    packages: dict[str, PackageRecord],
    package_names: set[str],
) -> dict[str, int]:
    summary: dict[str, int] = {}
    for name in package_names:
        package = packages.get(name)
        if package is None or not package.license_name:
            continue
        summary[package.license_name] = summary.get(package.license_name, 0) + 1
    return dict(sorted(summary.items(), key=lambda item: item[0]))


def _transitive_closure(
    packages: dict[str, PackageRecord],
    roots: tuple[str, ...],
) -> set[str]:
    closure: set[str] = set()
    stack = [name for name in roots if name in packages]

    while stack:
        name = stack.pop()
        if name in closure:
            continue
        closure.add(name)
        package = packages.get(name)
        if package is None:
            continue
        for dependency in package.dependencies:
            if dependency in packages and dependency not in closure:
                stack.append(dependency)

    return closure


def _dependency_name(raw_dependency: object) -> str | None:
    if not isinstance(raw_dependency, str):
        return None

    cleaned = raw_dependency.split(";", maxsplit=1)[0].strip()
    if not cleaned:
        return None

    cleaned = cleaned.split(" ", maxsplit=1)[0].strip()
    match = DEPENDENCY_NAME_PATTERN.match(cleaned)
    if match is None:
        return None
    return match.group(0).lower()


def _load_license(package_name: str) -> str | None:
    try:
        distribution = metadata.distribution(package_name)
    except metadata.PackageNotFoundError:
        return None

    license_expression = _optional_text(distribution.metadata.get("License-Expression"))
    if license_expression is not None:
        return license_expression

    license_name = _optional_text(distribution.metadata.get("License"))
    if license_name is not None:
        return license_name

    classifiers = distribution.metadata.get_all("Classifier") or []
    for classifier in classifiers:
        if isinstance(classifier, str) and classifier.startswith("License ::"):
            return classifier.split("::")[-1].strip()
    return None


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


if __name__ == "__main__":
    raise SystemExit(main())
