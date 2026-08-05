from __future__ import annotations

import hashlib
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection
from sqlalchemy.exc import IntegrityError

from silo.db.models import legacy_tables
from silo.services.pdf_artifacts import PdfArtifact
from silo.services.legacy_utils import new_uuid, now_naive

AI_ARTIFACT_KIND = "pdf"
AI_ARTIFACT_MIME_TYPE = "application/pdf"
AI_ARTIFACT_PENDING = "pending"
AI_ARTIFACT_READY = "ready"
AI_ARTIFACT_FAILED = "failed"


@dataclass(frozen=True, slots=True)
class AiArtifactLease:
    idempotency_hash: str
    owner_token: str
    lease_expires_at: datetime
    filename: str
    relative_path: str
    url: str


class AiArtifactRepository:
    def __init__(
        self,
        connection: Connection,
        *,
        artifact_table: Any | None = None,
        now_provider=now_naive,
        upload_kind: str = "reports",
    ) -> None:
        self._connection = connection
        self._table = artifact_table if artifact_table is not None else legacy_tables["ai_assistant_artifact"]
        self._now = now_provider
        self._upload_kind = upload_kind

    def get_by_idempotency_hash(self, idempotency_hash: str) -> dict[str, object] | None:
        row = self._connection.execute(
            select(self._table).where(self._table.c.idempotency_hash == idempotency_hash).limit(1)
        ).mappings().first()
        return dict(row) if row is not None else None

    def get_by_id(self, artifact_id: str) -> dict[str, object] | None:
        row = self._connection.execute(
            select(self._table).where(self._table.c.id == artifact_id).limit(1)
        ).mappings().first()
        return dict(row) if row is not None else None

    def claim(
        self,
        *,
        idempotency_hash: str,
        user_id: str,
        thread_id: str | None,
        report_type: str,
        request_fingerprint: str | None = None,
        dataset_checksum: str | None = None,
        metric_version: str | None = None,
        owner_token: str | None = None,
        lease_seconds: int = 300,
    ) -> AiArtifactLease | dict[str, object]:
        now = self._now()
        owner = owner_token or new_uuid()
        filename = build_ai_artifact_filename(report_type, idempotency_hash)
        relative_path = f"{self._upload_kind}/{filename}"
        url = f"/api/upload/serve/{self._upload_kind}/{filename}"
        lease_expires_at = now + timedelta(seconds=max(1, lease_seconds))

        with self._transaction():
            existing = self.get_by_idempotency_hash(idempotency_hash)
            if existing is not None:
                if str(existing.get("status") or "") == AI_ARTIFACT_READY:
                    return existing
                if self._can_retake_lease(existing, now):
                    updated = self._retake_lease(
                        artifact_id=str(existing["id"]),
                        owner_token=owner,
                        lease_expires_at=lease_expires_at,
                    )
                    if updated is not None:
                        return AiArtifactLease(
                            idempotency_hash=idempotency_hash,
                            owner_token=owner,
                            lease_expires_at=lease_expires_at,
                            filename=filename,
                            relative_path=relative_path,
                            url=url,
                        )
                return existing

            values = {
                "id": new_uuid(),
                "user_id": user_id,
                "thread_id": thread_id,
                "message_id": None,
                "kind": AI_ARTIFACT_KIND,
                "report_type": report_type,
                "idempotency_hash": idempotency_hash,
                "request_fingerprint": request_fingerprint,
                "dataset_checksum": dataset_checksum,
                "metric_version": metric_version,
                "status": AI_ARTIFACT_PENDING,
                "owner_token": owner,
                "lease_expires_at": lease_expires_at,
                "relative_path": relative_path,
                "url": url,
                "filename": filename,
                "mime_type": AI_ARTIFACT_MIME_TYPE,
                "byte_size": None,
                "file_sha256": None,
                "error_message": None,
                "attached_at": None,
                "created_at": now,
                "updated_at": now,
            }

            try:
                inserted = self._connection.execute(insert(self._table).values(values).returning(self._table))
                row = inserted.mappings().first()
                if row is not None:
                    return AiArtifactLease(
                        idempotency_hash=idempotency_hash,
                        owner_token=owner,
                        lease_expires_at=lease_expires_at,
                        filename=filename,
                        relative_path=relative_path,
                        url=url,
                    )
            except IntegrityError:
                existing = self.get_by_idempotency_hash(idempotency_hash)
                if existing is not None:
                    return existing

        return AiArtifactLease(
            idempotency_hash=idempotency_hash,
            owner_token=owner,
            lease_expires_at=lease_expires_at,
            filename=filename,
            relative_path=relative_path,
            url=url,
        )

    def mark_ready(
        self,
        *,
        idempotency_hash: str,
        owner_token: str,
        artifact: PdfArtifact,
        dataset_checksum: str,
        report_type: str,
        request_fingerprint: str | None = None,
        metric_version: str | None = None,
        attached_at: datetime | None = None,
    ) -> dict[str, object] | None:
        now = self._now()
        attached_value = attached_at
        with self._transaction():
            result = self._connection.execute(
                update(self._table)
                .where(
                    self._table.c.idempotency_hash == idempotency_hash,
                    self._table.c.owner_token == owner_token,
                    self._table.c.status == AI_ARTIFACT_PENDING,
                )
                .values(
                    status=AI_ARTIFACT_READY,
                    report_type=report_type,
                    request_fingerprint=request_fingerprint,
                    metric_version=metric_version,
                    dataset_checksum=dataset_checksum,
                    relative_path=f"{self._upload_kind}/{artifact.filename}",
                    url=artifact.url,
                    filename=artifact.filename,
                    mime_type=AI_ARTIFACT_MIME_TYPE,
                    byte_size=artifact.byte_size,
                    file_sha256=artifact.sha256,
                    error_message=None,
                    attached_at=attached_value,
                    updated_at=now,
                )
            )
            if result.rowcount and result.rowcount > 0:
                return self.get_by_idempotency_hash(idempotency_hash)

        return self.get_by_idempotency_hash(idempotency_hash)

    def mark_failed(
        self,
        *,
        idempotency_hash: str,
        owner_token: str,
        error_message: str,
    ) -> dict[str, object] | None:
        now = self._now()
        with self._transaction():
            result = self._connection.execute(
                update(self._table)
                .where(
                    self._table.c.idempotency_hash == idempotency_hash,
                    self._table.c.owner_token == owner_token,
                    self._table.c.status.in_((AI_ARTIFACT_PENDING, AI_ARTIFACT_READY)),
                )
                .values(
                    status=AI_ARTIFACT_FAILED,
                    error_message=error_message,
                    updated_at=now,
                )
            )
            if result.rowcount and result.rowcount > 0:
                return self.get_by_idempotency_hash(idempotency_hash)
        return self.get_by_idempotency_hash(idempotency_hash)

    def attach_artifact(
        self,
        *,
        idempotency_hash: str,
        owner_token: str,
        thread_id: str,
        message_id: str,
        attached_at: datetime | None = None,
    ) -> dict[str, object] | None:
        now = self._now()
        attached_value = attached_at or now
        with self._transaction():
            result = self._connection.execute(
                update(self._table)
                .where(
                    self._table.c.idempotency_hash == idempotency_hash,
                    self._table.c.owner_token == owner_token,
                    self._table.c.attached_at.is_(None),
                )
                .values(
                    thread_id=thread_id,
                    message_id=message_id,
                    attached_at=attached_value,
                    updated_at=now,
                )
            )
            if result.rowcount and result.rowcount > 0:
                return self.get_by_idempotency_hash(idempotency_hash)
        return self.get_by_idempotency_hash(idempotency_hash)

    def list_all(self) -> list[dict[str, object]]:
        rows = self._connection.execute(select(self._table)).mappings().all()
        return [dict(row) for row in rows]

    def list_pending_expired(self, now: datetime | None = None) -> list[dict[str, object]]:
        reference = now or self._now()
        rows = self._connection.execute(
            select(self._table)
            .where(
                self._table.c.status == AI_ARTIFACT_PENDING,
                self._table.c.lease_expires_at <= reference,
            )
            .order_by(self._table.c.created_at.asc())
        ).mappings().all()
        return [dict(row) for row in rows]

    def list_ready_unattached_older_than(self, cutoff: datetime) -> list[dict[str, object]]:
        rows = self._connection.execute(
            select(self._table)
            .where(
                self._table.c.status == AI_ARTIFACT_READY,
                self._table.c.attached_at.is_(None),
                self._table.c.created_at <= cutoff,
            )
            .order_by(self._table.c.created_at.asc())
        ).mappings().all()
        return [dict(row) for row in rows]

    def delete_artifact(self, artifact_id: str) -> None:
        with self._transaction():
            self._connection.execute(delete(self._table).where(self._table.c.id == artifact_id))

    def update_from_file(
        self,
        *,
        artifact_id: str,
        owner_token: str,
        filename: str,
        file_path: str,
        url: str,
        byte_size: int,
        file_sha256: str,
        dataset_checksum: str,
    ) -> dict[str, object] | None:
        now = self._now()
        with self._transaction():
            result = self._connection.execute(
                update(self._table)
                .where(
                    self._table.c.id == artifact_id,
                    self._table.c.owner_token == owner_token,
                )
                .values(
                    status=AI_ARTIFACT_READY,
                    filename=filename,
                    relative_path=file_path,
                    url=url,
                    byte_size=byte_size,
                    file_sha256=file_sha256,
                    dataset_checksum=dataset_checksum,
                    error_message=None,
                    updated_at=now,
                )
            )
            if result.rowcount and result.rowcount > 0:
                return self.get_by_id(artifact_id)
        return self.get_by_id(artifact_id)

    def _can_retake_lease(self, row: dict[str, object], now: datetime) -> bool:
        if str(row.get("status") or "") != AI_ARTIFACT_PENDING:
            return False
        lease_expires_at = row.get("lease_expires_at")
        return isinstance(lease_expires_at, datetime) and lease_expires_at <= now

    def _retake_lease(
        self,
        *,
        artifact_id: str,
        owner_token: str,
        lease_expires_at: datetime,
    ) -> dict[str, object] | None:
        now = self._now()
        with self._transaction():
            result = self._connection.execute(
                update(self._table)
                .where(
                    self._table.c.id == artifact_id,
                    self._table.c.status == AI_ARTIFACT_PENDING,
                    self._table.c.lease_expires_at <= now,
                )
                .values(
                    owner_token=owner_token,
                    lease_expires_at=lease_expires_at,
                    updated_at=now,
                )
            )
            if result.rowcount and result.rowcount > 0:
                return self.get_by_id(artifact_id)
        return None

    @contextmanager
    def _transaction(self):
        if self._connection.in_transaction():
            yield
            return
        with self._connection.begin():
            yield


def build_ai_artifact_filename(report_type: str, idempotency_hash: str) -> str:
    digest = hashlib.sha256(idempotency_hash.encode("utf-8")).hexdigest()
    return f"ai-{report_type}-{digest[:24]}.pdf"


def build_ai_artifact_url(filename: str, upload_kind: str = "reports") -> str:
    return f"/api/upload/serve/{upload_kind}/{filename}"
