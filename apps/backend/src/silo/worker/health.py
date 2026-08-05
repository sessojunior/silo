from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class WorkerHealthMonitor:
    state_file: Path | None = None
    health_stale_seconds: float = 30.0
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    last_poll_started_at: datetime | None = None
    last_poll_succeeded_at: datetime | None = None
    last_poll_finished_at: datetime | None = None
    last_activity_at: datetime | None = None
    last_error: str | None = None
    in_flight: int = 0

    def mark_poll_started(self) -> None:
        now = datetime.now(UTC)
        self.last_poll_started_at = now
        self.last_activity_at = now
        self.persist()

    def mark_poll_succeeded(self) -> None:
        now = datetime.now(UTC)
        self.last_poll_succeeded_at = now
        self.last_poll_finished_at = now
        self.last_activity_at = now
        self.last_error = None
        self.persist()

    def mark_poll_failed(self, error: object) -> None:
        now = datetime.now(UTC)
        self.last_poll_finished_at = now
        self.last_activity_at = now
        self.last_error = _sanitize_error(error)
        self.persist()

    def mark_error(self, error: object) -> None:
        now = datetime.now(UTC)
        self.last_activity_at = now
        self.last_error = _sanitize_error(error)
        self.persist()

    def mark_record_started(self) -> None:
        self.in_flight += 1
        self.last_activity_at = datetime.now(UTC)
        self.persist()

    def mark_record_finished(self) -> None:
        self.in_flight = max(0, self.in_flight - 1)
        now = datetime.now(UTC)
        self.last_poll_finished_at = now
        self.last_activity_at = now
        self.persist()

    def snapshot(self) -> dict[str, Any]:
        reference = datetime.now(UTC)
        return {
            "startedAt": _serialize_datetime(self.started_at),
            "lastPollStartedAt": _serialize_datetime(self.last_poll_started_at),
            "lastPollSucceededAt": _serialize_datetime(self.last_poll_succeeded_at),
            "lastPollFinishedAt": _serialize_datetime(self.last_poll_finished_at),
            "lastActivityAt": _serialize_datetime(self.last_activity_at),
            "lastError": self.last_error,
            "inFlight": self.in_flight,
            "healthStaleSeconds": self.health_stale_seconds,
            "healthy": self.is_healthy(reference=reference),
        }

    def is_healthy(self, *, reference: datetime | None = None) -> bool:
        now = reference or datetime.now(UTC)
        basis = (
            self.last_activity_at
            or self.last_poll_succeeded_at
            or self.last_poll_started_at
            or self.started_at
        )
        elapsed = (now - basis.astimezone(UTC)).total_seconds()
        if elapsed > self.health_stale_seconds:
            return False
        if self.in_flight < 0:
            return False
        return True

    def persist(self) -> None:
        if self.state_file is None:
            return
        payload = self.snapshot()
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self.state_file.with_suffix(self.state_file.suffix + ".tmp")
            tmp_path.write_text(
                json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2),
                encoding="utf-8",
            )
            tmp_path.replace(self.state_file)
        except Exception:
            return


def load_worker_health_state(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Worker health snapshot invalido.")
    return payload


def evaluate_worker_health(payload: dict[str, Any], *, stale_seconds: float) -> bool:
    healthy = bool(payload.get("healthy"))
    if not healthy:
        return False

    last_activity = _parse_datetime(payload.get("lastActivityAt"))
    started_at = _parse_datetime(payload.get("startedAt"))
    reference = datetime.now(UTC)
    basis = last_activity or started_at
    if basis is None:
        return False
    return (reference - basis).total_seconds() <= stale_seconds


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse_datetime(value: object | None) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _sanitize_error(error: object) -> str:
    text = str(error).strip()
    if not text:
        return "unknown error"
    return text[:240]
