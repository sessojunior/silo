from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine

from silo.services.ai_artifacts import (
    AiArtifactRepository,
    build_ai_artifact_filename,
    build_ai_artifact_url,
)
from silo.services.pdf_artifacts import PdfArtifact
from silo.worker import ai_artifacts as worker_ai_artifacts
from silo.worker.ai_artifacts import reconcile_ai_artifacts


def test_ai_artifact_repository_claim_ready_and_attach() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    artifact_table = _make_artifact_table(MetaData())
    artifact_table.metadata.create_all(engine)

    with engine.connect() as connection:
        repository = AiArtifactRepository(
            connection,
            artifact_table=artifact_table,
            now_provider=datetime.now,
        )
        lease = repository.claim(
            idempotency_hash="abc",
            user_id="user-1",
            thread_id="thread-1",
            report_type="executive",
            dataset_checksum="dataset-checksum",
        )

        assert getattr(lease, "filename", "").startswith("ai-executive-")
        assert lease.url == build_ai_artifact_url(lease.filename)

        artifact = PdfArtifact(
            file_path=Path("ignored"),
            filename="artifact.pdf",
            url=build_ai_artifact_url("artifact.pdf"),
            byte_size=128,
            sha256="a" * 64,
        )
        ready = repository.mark_ready(
            idempotency_hash="abc",
            owner_token=lease.owner_token,
            artifact=artifact,
            dataset_checksum="dataset-checksum",
            report_type="executive",
        )

        assert ready is not None
        assert ready["status"] == "ready"
        assert ready["filename"] == "artifact.pdf"
        assert ready["byte_size"] == 128

        attached = repository.attach_artifact(
            idempotency_hash="abc",
            owner_token=lease.owner_token,
            thread_id="thread-1",
            message_id="message-1",
        )
        assert attached is not None
        assert attached["attached_at"] is not None


def test_ai_artifact_reconciler_repairs_pending_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))

    uploads_dir = tmp_path / "uploads"
    reports_dir = uploads_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    pdf_bytes = b"%PDF-1.4 repair-me"
    filename = build_ai_artifact_filename("executive", "repair-hash")
    file_path = reports_dir / filename
    file_path.write_bytes(pdf_bytes)

    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    artifact_table = _make_artifact_table(MetaData())
    artifact_table.metadata.create_all(engine)
    now = datetime.now()
    lease_expires_at = now + timedelta(hours=1)

    with engine.connect() as connection:
        connection.execute(
            artifact_table.insert().values(
                id="artifact-1",
                user_id="user-1",
                thread_id="thread-1",
                message_id=None,
                kind="pdf",
                report_type="executive",
                idempotency_hash="repair-hash",
                request_fingerprint="req-1",
                dataset_checksum="checksum-1",
                metric_version="v1",
                status="pending",
                owner_token="owner-1",
                lease_expires_at=lease_expires_at,
                relative_path=f"reports/{filename}",
                url=build_ai_artifact_url(filename),
                filename=filename,
                mime_type="application/pdf",
                byte_size=None,
                file_sha256=None,
                error_message=None,
                attached_at=None,
                created_at=now,
                updated_at=now,
            )
        )

        summary = reconcile_ai_artifacts(
            connection,
            artifact_table=artifact_table,
            dry_run=False,
            retention_hours=24,
            now=now,
        )
        row = (
            connection.execute(
                artifact_table.select().where(artifact_table.c.id == "artifact-1")
            )
            .mappings()
            .first()
        )

    assert summary["pending_repaired_ready"] == 1
    assert row is not None
    assert row["status"] == "ready"
    assert row["byte_size"] == len(pdf_bytes)
    assert row["file_sha256"] is not None


def test_ai_artifact_repository_covers_listing_update_delete_and_retake_paths() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    artifact_table = _make_artifact_table(MetaData())
    artifact_table.metadata.create_all(engine)

    now = datetime(2026, 7, 23, 12, 0, 0)

    with engine.begin() as connection:
        connection.execute(
            artifact_table.insert(),
            [
                {
                    "id": "pending-1",
                    "user_id": "user-1",
                    "thread_id": "thread-1",
                    "message_id": None,
                    "kind": "pdf",
                    "report_type": "executive",
                    "idempotency_hash": "hash-pending",
                    "request_fingerprint": "fingerprint-1",
                    "dataset_checksum": "dataset-pending",
                    "metric_version": "metric-1",
                    "status": "pending",
                    "owner_token": "owner-1",
                    "lease_expires_at": now - timedelta(minutes=5),
                    "relative_path": "reports/pending.pdf",
                    "url": build_ai_artifact_url("pending.pdf"),
                    "filename": "pending.pdf",
                    "mime_type": "application/pdf",
                    "byte_size": None,
                    "file_sha256": None,
                    "error_message": None,
                    "attached_at": None,
                    "created_at": now - timedelta(days=2),
                    "updated_at": now - timedelta(days=2),
                },
                {
                    "id": "ready-1",
                    "user_id": "user-1",
                    "thread_id": "thread-1",
                    "message_id": None,
                    "kind": "pdf",
                    "report_type": "projects",
                    "idempotency_hash": "hash-ready",
                    "request_fingerprint": "fingerprint-2",
                    "dataset_checksum": "dataset-ready",
                    "metric_version": "metric-1",
                    "status": "ready",
                    "owner_token": "owner-2",
                    "lease_expires_at": now + timedelta(minutes=5),
                    "relative_path": "reports/ready.pdf",
                    "url": build_ai_artifact_url("ready.pdf"),
                    "filename": "ready.pdf",
                    "mime_type": "application/pdf",
                    "byte_size": 7,
                    "file_sha256": "b" * 64,
                    "error_message": None,
                    "attached_at": None,
                    "created_at": now - timedelta(days=2),
                    "updated_at": now - timedelta(days=2),
                },
                {
                    "id": "failed-1",
                    "user_id": "user-1",
                    "thread_id": "thread-1",
                    "message_id": None,
                    "kind": "pdf",
                    "report_type": "problems",
                    "idempotency_hash": "hash-failed",
                    "request_fingerprint": "fingerprint-3",
                    "dataset_checksum": "dataset-failed",
                    "metric_version": "metric-1",
                    "status": "failed",
                    "owner_token": "owner-3",
                    "lease_expires_at": now - timedelta(minutes=5),
                    "relative_path": "reports/failed.pdf",
                    "url": build_ai_artifact_url("failed.pdf"),
                    "filename": "failed.pdf",
                    "mime_type": "application/pdf",
                    "byte_size": 5,
                    "file_sha256": "c" * 64,
                    "error_message": "boom",
                    "attached_at": None,
                    "created_at": now - timedelta(days=3),
                    "updated_at": now - timedelta(days=3),
                },
            ],
        )

    with engine.connect() as connection:
        repository = AiArtifactRepository(
            connection,
            artifact_table=artifact_table,
            now_provider=lambda: now,
        )

        pending = repository.list_pending_expired(now)
        ready = repository.list_ready_unattached_older_than(now - timedelta(hours=1))
        pending_row = pending[0]
        ready_row = ready[0]

        assert repository._can_retake_lease(pending_row, now) is True  # noqa: SLF001
        assert repository._can_retake_lease(ready_row, now) is False  # noqa: SLF001
        assert repository._can_retake_lease({"status": "ready", "lease_expires_at": now}, now) is False  # noqa: SLF001
        assert build_ai_artifact_filename("executive", "hash-pending").startswith("ai-executive-")
        assert build_ai_artifact_url("ready.pdf") == "/api/upload/serve/reports/ready.pdf"

        retaken = repository._retake_lease(  # noqa: SLF001
            artifact_id="pending-1",
            owner_token="owner-4",
            lease_expires_at=now + timedelta(minutes=10),
        )
        assert retaken is not None
        assert retaken["owner_token"] == "owner-4"

        marked_failed = repository.mark_failed(  # noqa: SLF001
            idempotency_hash="hash-pending",
            owner_token="owner-4",
            error_message="boom",
        )
        assert marked_failed is not None
        assert marked_failed["status"] == "failed"
        assert marked_failed["error_message"] == "boom"

        updated = repository.update_from_file(  # noqa: SLF001
            artifact_id="ready-1",
            owner_token="owner-2",
            filename="ready-updated.pdf",
            file_path="reports/ready-updated.pdf",
            url="/api/upload/serve/reports/ready-updated.pdf",
            byte_size=11,
            file_sha256="d" * 64,
            dataset_checksum="dataset-ready-2",
        )
        assert updated is not None
        assert updated["filename"] == "ready-updated.pdf"
        assert updated["byte_size"] == 11
        assert updated["file_sha256"] == "d" * 64

        deleted = repository.get_by_id("ready-1")
        assert deleted is not None
        repository.delete_artifact("ready-1")
        assert repository.get_by_id("ready-1") is None


def test_worker_artifact_reconciler_covers_pending_ready_failed_and_dry_run_branches(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reports_dir = tmp_path / "uploads" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(
        worker_ai_artifacts,
        "resolve_upload_path",
        lambda _kind, filename: reports_dir / filename,
    )

    now = datetime(2026, 7, 23, 12, 0, 0)

    def _write_file(filename: str, content: bytes) -> Path:
        path = reports_dir / filename
        path.write_bytes(content)
        return path

    pending_existing = _write_file("pending-existing.pdf", b"%PDF pending existing")
    pending_fallback_filename = build_ai_artifact_filename("executive", "hash-fallback")
    pending_fallback = _write_file(pending_fallback_filename, b"%PDF pending fallback")
    pending_dry_file = _write_file("pending-dry.pdf", b"%PDF pending dry")
    ready_verified = _write_file("ready-match.pdf", b"ready verified")
    ready_mismatch = _write_file("ready-mismatch.pdf", b"ready mismatch")
    ready_dry_mismatch = _write_file("ready-dry-mismatch.pdf", b"ready dry mismatch")
    failed_old = _write_file("failed-old.pdf", b"failed old")

    ready_verified_meta = worker_ai_artifacts._read_file_meta(ready_verified)  # noqa: SLF001
    _ready_mismatch_meta = worker_ai_artifacts._read_file_meta(ready_mismatch)  # noqa: SLF001
    _ready_dry_mismatch_meta = worker_ai_artifacts._read_file_meta(ready_dry_mismatch)  # noqa: SLF001

    class _FakeRepository:
        def __init__(
            self,
            rows: list[dict[str, object]],
            *,
            mark_ready_result: dict[str, object] | None = None,
            update_from_file_result: dict[str, object] | None = None,
        ) -> None:
            self.rows = rows
            self.mark_ready_result = mark_ready_result
            self.update_from_file_result = update_from_file_result
            self.calls: list[tuple[str, object]] = []

        def list_all(self) -> list[dict[str, object]]:
            return list(self.rows)

        def mark_failed(self, **kwargs) -> None:
            self.calls.append(("mark_failed", kwargs))

        def mark_ready(self, **kwargs):
            self.calls.append(("mark_ready", kwargs))
            return self.mark_ready_result

        def update_from_file(self, **kwargs):
            self.calls.append(("update_from_file", kwargs))
            return self.update_from_file_result

        def delete_artifact(self, artifact_id: str) -> None:
            self.calls.append(("delete_artifact", artifact_id))

    repo_holder: dict[str, _FakeRepository] = {}
    monkeypatch.setattr(
        worker_ai_artifacts,
        "AiArtifactRepository",
        lambda _connection, artifact_table=None: repo_holder["repo"],
    )

    def _pending_row(
        *,
        artifact_id: str,
        filename: str | None,
        dataset_checksum: str | None,
        lease_expires_at: datetime,
        created_at: datetime,
        report_type: str = "executive",
        idempotency_hash: str = "hash-pending",
    ) -> dict[str, object]:
        return {
            "id": artifact_id,
            "user_id": "user-1",
            "thread_id": "thread-1",
            "message_id": None,
            "kind": "pdf",
            "report_type": report_type,
            "idempotency_hash": idempotency_hash,
            "request_fingerprint": "request-1",
            "dataset_checksum": dataset_checksum,
            "metric_version": "metric-1",
            "status": "pending",
            "owner_token": "owner-1",
            "lease_expires_at": lease_expires_at,
            "relative_path": f"reports/{filename}" if filename else None,
            "url": build_ai_artifact_url(filename or pending_fallback_filename),
            "filename": filename,
            "mime_type": "application/pdf",
            "byte_size": None,
            "file_sha256": None,
            "error_message": None,
            "attached_at": None,
            "created_at": created_at,
            "updated_at": created_at,
        }

    def _ready_row(
        *,
        artifact_id: str,
        filename: str,
        byte_size: int,
        file_sha256: str,
        created_at: datetime,
        attached_at: datetime | None,
    ) -> dict[str, object]:
        return {
            "id": artifact_id,
            "user_id": "user-1",
            "thread_id": "thread-1",
            "message_id": None,
            "kind": "pdf",
            "report_type": "projects",
            "idempotency_hash": f"hash-{artifact_id}",
            "request_fingerprint": "request-2",
            "dataset_checksum": f"dataset-{artifact_id}",
            "metric_version": "metric-1",
            "status": "ready",
            "owner_token": "owner-2",
            "lease_expires_at": created_at + timedelta(hours=1),
            "relative_path": f"reports/{filename}",
            "url": build_ai_artifact_url(filename),
            "filename": filename,
            "mime_type": "application/pdf",
            "byte_size": byte_size,
            "file_sha256": file_sha256,
            "error_message": None,
            "attached_at": attached_at,
            "created_at": created_at,
            "updated_at": created_at,
        }

    def _failed_row(*, artifact_id: str, filename: str, created_at: datetime) -> dict[str, object]:
        return {
            "id": artifact_id,
            "user_id": "user-1",
            "thread_id": "thread-1",
            "message_id": None,
            "kind": "pdf",
            "report_type": "problems",
            "idempotency_hash": f"hash-{artifact_id}",
            "request_fingerprint": "request-3",
            "dataset_checksum": f"dataset-{artifact_id}",
            "metric_version": "metric-1",
            "status": "failed",
            "owner_token": "owner-3",
            "lease_expires_at": created_at + timedelta(hours=1),
            "relative_path": f"reports/{filename}",
            "url": build_ai_artifact_url(filename),
            "filename": filename,
            "mime_type": "application/pdf",
            "byte_size": 4,
            "file_sha256": "c" * 64,
            "error_message": "boom",
            "attached_at": None,
            "created_at": created_at,
            "updated_at": created_at,
        }

    repo_holder["repo"] = _FakeRepository(
        [
            _pending_row(
                artifact_id="pending-missing-checksum",
                filename="pending-existing.pdf",
                dataset_checksum="",
                lease_expires_at=now + timedelta(hours=1),
                created_at=now - timedelta(days=1),
                idempotency_hash="hash-pending-missing",
            ),
            _pending_row(
                artifact_id="pending-ready",
                filename=None,
                dataset_checksum="dataset-pending-ready",
                lease_expires_at=now + timedelta(hours=1),
                created_at=now - timedelta(days=1),
                idempotency_hash="hash-fallback",
            ),
            _pending_row(
                artifact_id="pending-expired",
                filename="pending-expired.pdf",
                dataset_checksum="dataset-pending-expired",
                lease_expires_at=now - timedelta(hours=1),
                created_at=now - timedelta(days=1),
                idempotency_hash="hash-expired",
            ),
            _ready_row(
                artifact_id="ready-verified",
                filename="ready-match.pdf",
                byte_size=ready_verified_meta.byte_size,
                file_sha256=ready_verified_meta.sha256,
                created_at=now - timedelta(days=2),
                attached_at=now - timedelta(days=1),
            ),
            _ready_row(
                artifact_id="ready-mismatch",
                filename="ready-mismatch.pdf",
                byte_size=1,
                file_sha256="b" * 64,
                created_at=now - timedelta(days=2),
                attached_at=now - timedelta(days=1),
            ),
            _ready_row(
                artifact_id="ready-missing-recent",
                filename="ready-missing-recent.pdf",
                byte_size=1,
                file_sha256="b" * 64,
                created_at=now,
                attached_at=None,
            ),
            _ready_row(
                artifact_id="ready-missing-old",
                filename="ready-missing-old.pdf",
                byte_size=1,
                file_sha256="b" * 64,
                created_at=now - timedelta(days=3),
                attached_at=None,
            ),
            _failed_row(
                artifact_id="failed-old",
                filename="failed-old.pdf",
                created_at=now - timedelta(days=4),
            ),
        ],
        mark_ready_result={"status": "ready"},
        update_from_file_result={"status": "ready"},
    )

    summary = reconcile_ai_artifacts(SimpleNamespace(), dry_run=False, retention_hours=24, now=now)
    assert summary["scanned"] == 8
    assert summary["pending_expired_failed"] == 2
    assert summary["pending_repaired_ready"] == 1
    assert summary["ready_verified"] == 1
    assert summary["ready_repaired"] == 1
    assert summary["ready_pruned"] == 1
    assert summary["failed_pruned"] == 1
    assert summary["errors"] == 1
    assert any(call[0] == "mark_ready" for call in repo_holder["repo"].calls)
    assert any(call[0] == "update_from_file" for call in repo_holder["repo"].calls)
    assert any(call == ("delete_artifact", "ready-missing-old") for call in repo_holder["repo"].calls)
    assert any(call == ("delete_artifact", "failed-old") for call in repo_holder["repo"].calls)
    assert pending_existing.exists()
    assert pending_fallback.exists()

    repo_holder["repo"] = _FakeRepository(
        [
            _pending_row(
                artifact_id="pending-dry",
                filename="pending-dry.pdf",
                dataset_checksum="dataset-pending-dry",
                lease_expires_at=now + timedelta(hours=1),
                created_at=now - timedelta(hours=1),
                idempotency_hash="hash-pending-dry",
            ),
            _ready_row(
                artifact_id="ready-dry",
                filename="ready-dry-mismatch.pdf",
                byte_size=1,
                file_sha256="a" * 64,
                created_at=now - timedelta(days=2),
                attached_at=now - timedelta(days=1),
            ),
            _pending_row(
                artifact_id="pending-dry-missing",
                filename="pending-existing.pdf",
                dataset_checksum="",
                lease_expires_at=now + timedelta(hours=1),
                created_at=now - timedelta(hours=1),
                idempotency_hash="hash-pending-dry-missing",
            ),
        ],
        mark_ready_result=None,
        update_from_file_result=None,
    )

    summary_dry_run = reconcile_ai_artifacts(SimpleNamespace(), dry_run=True, retention_hours=24, now=now)
    assert summary_dry_run["pending_expired_failed"] == 1
    assert summary_dry_run["pending_repaired_ready"] == 1
    assert summary_dry_run["ready_repaired"] == 1
    assert repo_holder["repo"].calls == []
    assert pending_dry_file.exists()


def test_worker_main_and_reconciliation_lock_paths(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    class _LockResult:
        def __init__(self, value: bool) -> None:
            self.value = value

        def scalar(self) -> bool:
            return self.value

    class _LockConnection:
        def __init__(self, dialect_name: str, acquired: bool = True) -> None:
            self.dialect = SimpleNamespace(name=dialect_name)
            self.acquired = acquired
            self.execute_calls: list[tuple[str, dict[str, object] | None]] = []
            self.commit_calls = 0

        def __enter__(self) -> "_LockConnection":
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def execute(self, statement, params=None):  # noqa: ANN001
            self.execute_calls.append((str(statement), params))
            if "pg_try_advisory_lock" in str(statement):
                return _LockResult(self.acquired)
            return _LockResult(True)

        def commit(self) -> None:
            self.commit_calls += 1

    sqlite_connection = _LockConnection("sqlite")
    with worker_ai_artifacts._reconciliation_lock(sqlite_connection):  # noqa: SLF001
        pass
    assert sqlite_connection.execute_calls == []

    postgres_connection = _LockConnection("postgresql", acquired=True)
    with worker_ai_artifacts._reconciliation_lock(postgres_connection):  # noqa: SLF001
        pass
    assert any("pg_try_advisory_lock" in call[0] for call in postgres_connection.execute_calls)
    assert any("pg_advisory_unlock" in call[0] for call in postgres_connection.execute_calls)

    with pytest.raises(RuntimeError):
        with worker_ai_artifacts._reconciliation_lock(_LockConnection("postgresql", acquired=False)):  # noqa: SLF001
            pass

    class _FakeEngine:
        def __init__(self, connection: _LockConnection) -> None:
            self.connection = connection
            self.dispose_calls = 0

        def connect(self) -> _LockConnection:
            return self.connection

        def dispose(self) -> None:
            self.dispose_calls += 1

    fake_engine = _FakeEngine(sqlite_connection)
    monkeypatch.setattr(worker_ai_artifacts, "load_settings", lambda: SimpleNamespace(database_url=SimpleNamespace(get_secret_value=lambda: "sqlite:///db.sqlite")))
    monkeypatch.setattr(worker_ai_artifacts, "sqlalchemy_database_url", lambda url: f"converted:{url}")
    monkeypatch.setattr(worker_ai_artifacts, "create_engine", lambda url, pool_pre_ping=True: fake_engine)
    monkeypatch.setattr(worker_ai_artifacts, "reconcile_ai_artifacts", lambda connection, **kwargs: {"scanned": 1, "pending_expired_failed": 0, "pending_repaired_ready": 0, "ready_verified": 0, "ready_repaired": 0, "ready_pruned": 0, "failed_pruned": 0, "errors": 0})

    exit_code = worker_ai_artifacts.main([])
    output = json.loads(capsys.readouterr().out)
    assert exit_code == 0
    assert output["scanned"] == 1
    assert sqlite_connection.commit_calls == 1
    assert fake_engine.dispose_calls == 1

    exit_code_dry = worker_ai_artifacts.main(["--dry-run", "--retention-hours", "12"])
    output_dry = json.loads(capsys.readouterr().out)
    assert exit_code_dry == 0
    assert output_dry["scanned"] == 1
    assert sqlite_connection.commit_calls == 1
    assert fake_engine.dispose_calls == 2


def _make_artifact_table(metadata: MetaData) -> Table:
    return Table(
        "ai_assistant_artifact",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String),
        Column("thread_id", String),
        Column("message_id", String),
        Column("kind", String),
        Column("report_type", String),
        Column("idempotency_hash", String, nullable=False, unique=True),
        Column("request_fingerprint", String),
        Column("dataset_checksum", String),
        Column("metric_version", String),
        Column("status", String),
        Column("owner_token", String),
        Column("lease_expires_at", DateTime),
        Column("relative_path", String),
        Column("url", String),
        Column("filename", String),
        Column("mime_type", String),
        Column("byte_size", Integer),
        Column("file_sha256", String),
        Column("error_message", String),
        Column("attached_at", DateTime),
        Column("created_at", DateTime),
        Column("updated_at", DateTime),
    )
