from __future__ import annotations

import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCAN_ROOTS = ("src", "tests", "migrations")
SKIPPED_PATH_PARTS = {".venv", ".mypy_cache", ".pytest_cache", ".ruff_cache", "__pycache__"}


def _is_apps_module(module_name: str | None) -> bool:
    return module_name == "apps" or bool(module_name and module_name.startswith("apps."))


def _attribute_path(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _attribute_path(node.value)
        if parent is None:
            return None
        return f"{parent}.{node.attr}"
    return None


def _first_string_argument(node: ast.Call) -> str | None:
    if not node.args:
        return None
    first_arg = node.args[0]
    if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
        return first_arg.value
    return None


def _python_files() -> list[Path]:
    paths: list[Path] = []
    for root_name in SCAN_ROOTS:
        root = PROJECT_ROOT / root_name
        if not root.exists():
            continue
        paths.extend(
            path for path in root.rglob("*.py") if not SKIPPED_PATH_PARTS.intersection(path.parts)
        )
    return sorted(paths)


def _module_aliases(tree: ast.Module, canonical_module: str) -> set[str]:
    aliases: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Import):
            continue
        for alias in node.names:
            if alias.name == canonical_module:
                aliases.add(alias.asname or canonical_module)
    return aliases


def _import_module_aliases(tree: ast.Module) -> set[str]:
    aliases: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or node.module != "importlib":
            continue
        for alias in node.names:
            if alias.name == "import_module":
                aliases.add(alias.asname or "import_module")
    return aliases


def _violations_for(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    sys_aliases = _module_aliases(tree, "sys")
    importlib_aliases = _module_aliases(tree, "importlib")
    import_module_aliases = _import_module_aliases(tree)
    relative_path = path.relative_to(PROJECT_ROOT).as_posix()
    violations: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _is_apps_module(alias.name):
                    violations.append(
                        f"{relative_path}:{node.lineno}: import proibido de `{alias.name}`"
                    )
            continue

        if isinstance(node, ast.ImportFrom):
            if _is_apps_module(node.module):
                violations.append(
                    f"{relative_path}:{node.lineno}: import proibido de `{node.module}`"
                )
            if node.module == "sys":
                for alias in node.names:
                    if alias.name == "path":
                        violations.append(
                            f"{relative_path}:{node.lineno}: `from sys import path` proibido"
                        )
            continue

        if isinstance(node, ast.Attribute):
            if node.attr == "path" and _attribute_path(node.value) in sys_aliases:
                violations.append(f"{relative_path}:{node.lineno}: uso de `sys.path` proibido")
            continue

        if isinstance(node, ast.Call):
            module_name = _first_string_argument(node)
            if not _is_apps_module(module_name):
                continue

            function_name = _attribute_path(node.func)
            importlib_imports = {f"{alias}.import_module" for alias in importlib_aliases}
            if function_name in importlib_imports or function_name in import_module_aliases:
                violations.append(
                    f"{relative_path}:{node.lineno}: import dinamico proibido de `{module_name}`"
                )
            if function_name == "__import__":
                violations.append(
                    f"{relative_path}:{node.lineno}: import dinamico proibido de `{module_name}`"
                )

    return violations


def test_backend_import_boundaries() -> None:
    violations = [violation for path in _python_files() for violation in _violations_for(path)]

    assert not violations, "Violacoes de fronteira de import do backend:\n" + "\n".join(violations)
