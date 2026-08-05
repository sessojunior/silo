from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from silo.api.main import create_app
from silo.api.openapi_export import (
    generate_openapi_document,
    main,
    render_openapi_json,
    render_openapi_typescript,
)


def test_openapi_and_docs_are_hidden_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SILO_ENV", "production")

    client = TestClient(create_app())

    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_openapi_remains_available_outside_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")

    response = TestClient(create_app()).get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "SILO API"


def test_openapi_exporter_renders_deterministic_json_and_typescript(tmp_path: Path) -> None:
    document = generate_openapi_document()
    json_output = tmp_path / "openapi.json"
    ts_output = tmp_path / "openapi.ts"

    assert main(["--json-output", str(json_output), "--ts-output", str(ts_output)]) == 0
    assert json_output.read_text(encoding="utf-8") == render_openapi_json(document)
    assert ts_output.read_text(encoding="utf-8") == render_openapi_typescript(document)
    assert main(["--json-output", str(json_output), "--ts-output", str(ts_output), "--check"]) == 0

    ts_output.write_text("// stale\n", encoding="utf-8")
    assert main(["--json-output", str(json_output), "--ts-output", str(ts_output), "--check"]) == 1
