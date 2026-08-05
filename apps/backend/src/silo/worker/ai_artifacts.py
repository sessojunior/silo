from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from silo.config import load_settings
from silo.db.url import sqlalchemy_database_url
from silo.services.ai_artifacts import (
    AI_ARTIFACT_FAILED,
    AI_ARTIFACT_PENDING,
    AI_ARTIFACT_READY,
    AiArtifactRepository,
    build_ai_artifact_filename,
)
from silo.services.pdf_artifacts import PdfArtifact
from silo.storage.uploads import resolve_upload_path

RECONCILIATION_LOCK_KEY = 4_202_607_23_01


@dataclass(frozen=True, slots=True)
class ReconciliationSummary:
    scanned: int = 0
    pending_expired_failed: int = 0
    pending_repaired_ready: int = 0
    ready_verified: int = 0
    ready_repaired: int = 0
    ready_pruned: int = 0
    failed_pruned: int = 0
    errors: int = 0


def reconcile_ai_artifacts(
    connection: Connection,
    *,
    dry_run: bool = False,
    retention_hours: int = 24,
    now: datetime | None = None,
    artifact_table: Any | None = None,
) -> dict[str, int]:
    repository = AiArtifactRepository(connection, artifact_table=artifact_table)
    reference = now or datetime.now()
    cutoff = reference - timedelta(hours=max(1, retention_hours))
    summary = {
        "scanned": 0,
        "pending_expired_failed": 0,
        "pending_repaired_ready": 0,
        "ready_verified": 0,
        "ready_repaired": 0,
        "ready_pruned": 0,
        "failed_pruned": 0,
        "errors": 0,
    }

    rows = repository.list_all()
    summary["scanned"] = len(rows)
    for row in rows:
        try:
            status = str(row.get("status") or "")
            if status == AI_ARTIFACT_PENDING:
                _reconcile_pending(repository, row, now=reference, dry_run=dry_run, summary=summary)
            elif status == AI_ARTIFACT_READY:
                _reconcile_ready(repository, row, cutoff=cutoff, dry_run=dry_run, summary=summary)
            elif status == AI_ARTIFACT_FAILED:
                _reconcile_failed(repository, row, cutoff=cutoff, dry_run=dry_run, summary=summary)
        except Exception:
            summary["errors"] += 1

    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Reconcilia artefatos da assistente de IA.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Não altera o estado do banco ou arquivos.",
    )
    parser.add_argument(
        "--retention-hours",
        type=int,
        default=24,
        help="Janela de retenção para limpeza de artefatos órfãos.",
    )
    args = parser.parse_args(argv)

    settings = load_settings()
    engine = create_engine(
        sqlalchemy_database_url(settings.database_url.get_secret_value()),
        pool_pre_ping=True,
    )
    try:
        with engine.connect() as connection:
            with _reconciliation_lock(connection):
                summary = reconcile_ai_artifacts(
                    connection,
                    dry_run=args.dry_run,
                    retention_hours=args.retention_hours,
                )
                if not args.dry_run:
                    connection.commit()
    finally:
        engine.dispose()

    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


def _reconcile_pending(
    repository: AiArtifactRepository,
    row: dict[str, Any],
    *,
    now: datetime,
    dry_run: bool,
    summary: dict[str, int],
) -> None:
    filename = _artifact_filename(row)
    path = _resolve_report_path(filename)
    if path is not None and path.exists():
        file_meta = _read_file_meta(path)
        dataset_checksum = str(row.get("dataset_checksum") or "")
        if not dataset_checksum:
            _mark_failed(repository, row, "DATASET_CHECKSUM_MISSING", dry_run=dry_run)
            summary["pending_expired_failed"] += 1
            return

        if dry_run:
            summary["pending_repaired_ready"] += 1
            return

        artifact = _artifact_from_file(row, path, file_meta)
        updated = repository.mark_ready(
            idempotency_hash=str(row["idempotency_hash"]),
            owner_token=str(row["owner_token"]),
            artifact=artifact,
            dataset_checksum=dataset_checksum,
            report_type=str(row.get("report_type") or "pdf"),
            request_fingerprint=_optional_text(row.get("request_fingerprint")),
            metric_version=_optional_text(row.get("metric_version")),
        )
        if updated is not None:
            summary["pending_repaired_ready"] += 1
            return

    if _lease_expired(row, now):
        _mark_failed(repository, row, "LEASE_EXPIRED", dry_run=dry_run)
        summary["pending_expired_failed"] += 1


def _reconcile_ready(
    repository: AiArtifactRepository,
    row: dict[str, Any],
    *,
    cutoff: datetime,
    dry_run: bool,
    summary: dict[str, int],
) -> None:
    filename = _artifact_filename(row)
    path = _resolve_report_path(filename)
    attached_at = row.get("attached_at")

    if path is None or not path.exists():
        if _is_old_or_orphaned(row, cutoff):
            if not dry_run:
                repository.delete_artifact(str(row["id"]))
            summary["ready_pruned"] += 1
            return

        _mark_failed(repository, row, "FILE_MISSING", dry_run=dry_run)
        summary["errors"] += 1
        return

    file_meta = _read_file_meta(path)
    expected_size = row.get("byte_size")
    expected_sha = _optional_text(row.get("file_sha256"))
    if expected_size == file_meta.byte_size and expected_sha == file_meta.sha256:
        summary["ready_verified"] += 1
        return

    if dry_run:
        summary["ready_repaired"] += 1
        return

    updated = repository.update_from_file(
        artifact_id=str(row["id"]),
        owner_token=str(row["owner_token"]),
        filename=path.name,
        file_path=f"reports/{path.name}",
        url=f"/api/upload/serve/reports/{path.name}",
        byte_size=file_meta.byte_size,
        file_sha256=file_meta.sha256,
        dataset_checksum=str(row.get("dataset_checksum") or ""),
    )
    if updated is not None:
        summary["ready_repaired"] += 1
        return

    if attached_at is None and _is_old_or_orphaned(row, cutoff):
        if not dry_run:
            repository.delete_artifact(str(row["id"]))
        summary["ready_pruned"] += 1


def _reconcile_failed(
    repository: AiArtifactRepository,
    row: dict[str, Any],
    *,
    cutoff: datetime,
    dry_run: bool,
    summary: dict[str, int],
) -> None:
    if not _is_old_or_orphaned(row, cutoff):
        return
    filename = _artifact_filename(row)
    path = _resolve_report_path(filename)
    if path is not None and path.exists() and not dry_run:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
    if not dry_run:
        repository.delete_artifact(str(row["id"]))
    summary["failed_pruned"] += 1


def _mark_failed(
    repository: AiArtifactRepository,
    row: dict[str, Any],
    error_message: str,
    *,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    repository.mark_failed(
        idempotency_hash=str(row["idempotency_hash"]),
        owner_token=str(row["owner_token"]),
        error_message=error_message,
    )


def _artifact_filename(row: dict[str, Any]) -> str:
    filename = _optional_text(row.get("filename"))
    if filename:
        return filename
    report_type = _optional_text(row.get("report_type")) or "pdf"
    idempotency_hash = _optional_text(row.get("idempotency_hash")) or ""
    return build_ai_artifact_filename(report_type, idempotency_hash)


def _resolve_report_path(filename: str) -> Path | None:
    return resolve_upload_path("reports", filename)


def _read_file_meta(path: Path) -> _FileMeta:
    data = path.read_bytes()
    return _FileMeta(byte_size=len(data), sha256=hashlib.sha256(data).hexdigest())


def _artifact_from_file(row: dict[str, Any], path: Path, file_meta: _FileMeta) -> PdfArtifact:
    return PdfArtifact(
        file_path=path,
        filename=path.name,
        url=f"/api/upload/serve/reports/{path.name}",
        byte_size=file_meta.byte_size,
        sha256=file_meta.sha256,
    )


@dataclass(frozen=True, slots=True)
class _FileMeta:
    byte_size: int
    sha256: str


def _lease_expired(row: dict[str, Any], now: datetime) -> bool:
    lease_expires_at = row.get("lease_expires_at")
    return isinstance(lease_expires_at, datetime) and lease_expires_at <= now


def _is_old_or_orphaned(row: dict[str, Any], cutoff: datetime) -> bool:
    created_at = row.get("created_at")
    return (
        isinstance(created_at, datetime) and created_at <= cutoff and row.get("attached_at") is None
    )


def _optional_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


@contextmanager
def _reconciliation_lock(connection: Connection) -> Iterator[None]:
    if connection.dialect.name != "postgresql":
        yield
        return

    acquired = connection.execute(
        text("select pg_try_advisory_lock(:lock_key)"),
        {"lock_key": RECONCILIATION_LOCK_KEY},
    ).scalar()
    if not acquired:
        raise RuntimeError("Reconciliação já em execução.")

    try:
        yield
    finally:
        try:
            connection.execute(
                text("select pg_advisory_unlock(:lock_key)"),
                {"lock_key": RECONCILIATION_LOCK_KEY},
            )
        except Exception:
            pass
