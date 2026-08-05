from __future__ import annotations

import math
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import and_, case, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Connection
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.sql.dml import Insert

from silo.db.models import legacy_tables

RATE_LIMIT_DB_UNAVAILABLE_RETRY_AFTER_SECONDS = 60


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    reset_epoch_seconds: int
    retry_after_seconds: int


@dataclass(frozen=True, slots=True)
class AuthRateLimitStatus:
    is_limited: bool
    retry_after_seconds: int
    count: int
    limit: int


@dataclass(frozen=True, slots=True)
class _WindowCounter:
    count: int
    reset_at: float


class GlobalRateLimiter:
    def __init__(self, *, max_requests: int = 200, window_seconds: int = 60) -> None:
        if max_requests < 1:
            raise ValueError("max_requests must be >= 1")
        if window_seconds < 1:
            raise ValueError("window_seconds must be >= 1")

        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._counters: dict[str, _WindowCounter] = {}
        self._lock = threading.Lock()

    def check(self, identity: str, *, now: float | None = None) -> RateLimitDecision:
        current_time = datetime.now(UTC).timestamp() if now is None else now
        with self._lock:
            counter = self._counters.get(identity)
            if counter is None or counter.reset_at <= current_time:
                reset_at = current_time + self._window_seconds
                counter = _WindowCounter(count=1, reset_at=reset_at)
                self._counters[identity] = counter
                return RateLimitDecision(
                    allowed=True,
                    limit=self._max_requests,
                    remaining=self._max_requests - 1,
                    reset_epoch_seconds=math.ceil(reset_at),
                    retry_after_seconds=0,
                )

            if counter.count >= self._max_requests:
                retry_after_seconds = math.ceil(counter.reset_at - current_time)
                return RateLimitDecision(
                    allowed=False,
                    limit=self._max_requests,
                    remaining=0,
                    reset_epoch_seconds=math.ceil(counter.reset_at),
                    retry_after_seconds=max(1, retry_after_seconds),
                )

            next_count = counter.count + 1
            self._counters[identity] = _WindowCounter(
                count=next_count,
                reset_at=counter.reset_at,
            )
            return RateLimitDecision(
                allowed=True,
                limit=self._max_requests,
                remaining=max(0, self._max_requests - next_count),
                reset_epoch_seconds=math.ceil(counter.reset_at),
                retry_after_seconds=0,
            )


def get_auth_rate_limit_status(
    connection: Connection,
    *,
    email: str,
    ip: str,
    route: str,
    limit: int = 3,
    window_seconds: int = 60,
    now: datetime | None = None,
) -> AuthRateLimitStatus:
    current_time = _coerce_legacy_db_time(now)
    window_start = current_time - timedelta(seconds=window_seconds)
    rate_limit_table = legacy_tables["rate_limit"]

    try:
        clean_auth_rate_limit_records(connection)
        row = (
            connection.execute(
                select(
                    rate_limit_table.c.count,
                    rate_limit_table.c.last_request,
                ).where(
                    and_(
                        rate_limit_table.c.email == email,
                        rate_limit_table.c.ip == ip,
                        rate_limit_table.c.route == route,
                    )
                )
            )
            .mappings()
            .first()
        )
    except (DBAPIError, OperationalError) as exc:
        if _is_database_infrastructure_error(exc):
            return AuthRateLimitStatus(
                is_limited=True,
                retry_after_seconds=RATE_LIMIT_DB_UNAVAILABLE_RETRY_AFTER_SECONDS,
                count=limit,
                limit=limit,
            )
        raise

    if row is None or row["last_request"] < window_start:
        return AuthRateLimitStatus(is_limited=False, retry_after_seconds=0, count=0, limit=limit)

    count = int(row["count"])
    if count < limit:
        return AuthRateLimitStatus(
            is_limited=False,
            retry_after_seconds=0,
            count=count,
            limit=limit,
        )

    unlock_at = row["last_request"] + timedelta(seconds=window_seconds)
    retry_after_seconds = math.ceil(max(0.0, (unlock_at - current_time).total_seconds()))
    return AuthRateLimitStatus(
        is_limited=True,
        retry_after_seconds=retry_after_seconds,
        count=count,
        limit=limit,
    )


def record_auth_rate_limit(
    connection: Connection,
    *,
    email: str,
    ip: str,
    route: str,
    window_seconds: int = 60,
    now: datetime | None = None,
) -> None:
    current_time = _coerce_legacy_db_time(now)
    try:
        connection.execute(
            build_record_auth_rate_limit_statement(
                email=email,
                ip=ip,
                route=route,
                window_seconds=window_seconds,
                now=current_time,
            )
        )
    except (DBAPIError, OperationalError) as exc:
        if _is_database_infrastructure_error(exc):
            return
        raise


def clear_auth_rate_limit_for_email(
    connection: Connection,
    *,
    email: str,
    routes: tuple[str, ...] = (),
) -> None:
    normalized_email = email.strip().lower()
    if not normalized_email:
        return

    rate_limit_table = legacy_tables["rate_limit"]
    statement = delete(rate_limit_table).where(rate_limit_table.c.email == normalized_email)
    if routes:
        statement = statement.where(rate_limit_table.c.route.in_(routes))

    try:
        connection.execute(statement)
    except (DBAPIError, OperationalError) as exc:
        if _is_database_infrastructure_error(exc):
            return
        raise


def clean_auth_rate_limit_records(
    connection: Connection,
    *,
    older_than_minutes: int = 60,
    now: datetime | None = None,
) -> None:
    threshold = _coerce_legacy_db_time(now) - timedelta(minutes=older_than_minutes)
    rate_limit_table = legacy_tables["rate_limit"]
    connection.execute(delete(rate_limit_table).where(rate_limit_table.c.last_request < threshold))


def build_record_auth_rate_limit_statement(
    *,
    email: str,
    ip: str,
    route: str,
    window_seconds: int = 60,
    now: datetime | None = None,
) -> Insert:
    current_time = _coerce_legacy_db_time(now)
    reset_window = current_time - timedelta(seconds=window_seconds)
    rate_limit_table = legacy_tables["rate_limit"]

    return (
        insert(rate_limit_table)
        .values(
            id=str(uuid4()),
            route=route,
            email=email,
            ip=ip,
            count=1,
            last_request=current_time,
        )
        .on_conflict_do_update(
            index_elements=[
                rate_limit_table.c.email,
                rate_limit_table.c.ip,
                rate_limit_table.c.route,
            ],
            set_={
                "count": case(
                    (rate_limit_table.c.last_request < reset_window, 1),
                    else_=rate_limit_table.c.count + 1,
                ),
                "last_request": current_time,
            },
        )
    )


def _coerce_legacy_db_time(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(UTC).replace(tzinfo=None)
    if value.tzinfo is not None:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


def _is_database_infrastructure_error(exc: Exception) -> bool:
    if isinstance(exc, OperationalError):
        return True
    if isinstance(exc, DBAPIError):
        return bool(exc.connection_invalidated)
    return False
