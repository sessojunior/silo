from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

import pytest

from silo.domain.model_run_status import PROBLEM_STATUSES
from silo.domain.scheduling import SHIFT_CODES
from silo.services.analytics_common import (
    build_analytics_meta,
    format_br_day_short,
    format_local_date_text,
    format_local_datetime_text,
    is_incident_status,
    normalize_shift_turns,
    run_repeatable_read_snapshot,
)


@dataclass
class _FakeTransaction:
    rollback_calls: int = 0

    def rollback(self) -> None:
        self.rollback_calls += 1


class _FakeConnection:
    def __init__(self) -> None:
        self.transaction = _FakeTransaction()
        self.statements: list[str] = []
        self.params: list[dict[str, object]] = []

    def begin(self) -> _FakeTransaction:
        return self.transaction

    def execute(self, statement, params=None, **kwargs):  # type: ignore[no-untyped-def]
        self.statements.append(str(statement))
        if params is not None:
            self.params.append(dict(params) if isinstance(params, dict) else {})
        return None


def test_analytics_common_status_and_meta_helpers() -> None:
    problem_status = next(iter(PROBLEM_STATUSES))

    meta = build_analytics_meta(
        source_kind="dashboard_summary",
        range_start="2026-07-01",
        range_end="2026-07-22",
        denominator="incidentRows",
        rounding=0,
        complete=False,
        extra={"section": "overview"},
    )

    assert is_incident_status(problem_status) is True
    assert is_incident_status("completed") is False
    assert normalize_shift_turns(["18", 6, "18"]) == ["18", "6"]
    assert normalize_shift_turns(None) == list(SHIFT_CODES)
    assert meta["sourceKind"] == "dashboard_summary"
    assert meta["range"] == {"start": "2026-07-01", "end": "2026-07-22", "inclusive": True}
    assert meta["denominator"] == "incidentRows"
    assert meta["complete"] is False
    assert meta["section"] == "overview"


def test_analytics_common_formatting_helpers() -> None:
    naive_dt = datetime(2026, 7, 22, 15, 45)
    aware_dt = datetime(2026, 7, 22, 15, 45, tzinfo=UTC)

    assert format_local_date_text(date(2026, 7, 22)) == "2026-07-22"
    assert format_local_date_text(naive_dt) == "2026-07-22"
    assert format_local_date_text(aware_dt) == "2026-07-22"
    assert format_local_date_text(" 2026-07-22 ") == "2026-07-22"
    assert format_local_date_text(None) is None

    assert format_local_datetime_text(naive_dt) == "2026-07-22 15:45:00"
    assert format_local_datetime_text(aware_dt) == "2026-07-22 12:45:00"
    assert format_local_datetime_text(" 2026-07-22T15:45:00Z ") == "2026-07-22 12:45:00"
    assert format_local_datetime_text(None) is None

    assert format_br_day_short(date(2026, 7, 22)) == "22/07/"
    assert format_br_day_short(naive_dt) == "22/07/"
    assert format_br_day_short("2026-07-22") == "22/07/"
    assert format_br_day_short("plain text") == "plain text"
    assert format_br_day_short(None) == ""


def test_run_repeatable_read_snapshot_rolls_back_on_success_and_failure() -> None:
    connection = _FakeConnection()

    result = run_repeatable_read_snapshot(connection, lambda: "ok", statement_timeout_ms=1_234)

    assert result == "ok"
    assert connection.transaction.rollback_calls == 1
    assert any("REPEATABLE READ READ ONLY" in statement for statement in connection.statements)
    assert any(
        params.get("timeout") == "1234ms"
        for params in connection.params
    )

    failure_connection = _FakeConnection()

    with pytest.raises(RuntimeError, match="boom"):
        run_repeatable_read_snapshot(
            failure_connection,
            lambda: (_ for _ in ()).throw(RuntimeError("boom")),
        )

    assert failure_connection.transaction.rollback_calls == 1
