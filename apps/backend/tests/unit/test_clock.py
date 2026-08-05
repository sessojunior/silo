from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from silo.clock import (
    FrozenClock,
    SequenceIdGenerator,
    SystemClock,
    Uuid4IdGenerator,
    ensure_utc,
    new_id,
    parse_uuid,
    utc_now,
)


def test_system_clock_returns_timezone_aware_utc_datetime() -> None:
    value = SystemClock().now()

    assert value.tzinfo is UTC


def test_frozen_clock_is_injectable_and_mutable_for_tests() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))

    assert utc_now(clock) == datetime(2026, 7, 22, 12, 0, tzinfo=UTC)
    assert clock.advance(timedelta(minutes=5)) == datetime(2026, 7, 22, 12, 5, tzinfo=UTC)

    clock.set(datetime(2026, 7, 23, 8, 30, tzinfo=UTC))

    assert clock.now() == datetime(2026, 7, 23, 8, 30, tzinfo=UTC)


def test_clock_rejects_naive_datetime() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        FrozenClock(datetime(2026, 7, 22, 12, 0))


def test_ensure_utc_normalizes_aware_datetime() -> None:
    value = datetime(2026, 7, 22, 9, 0, tzinfo=UTC)

    assert ensure_utc(value) == datetime(2026, 7, 22, 9, 0, tzinfo=UTC)


def test_uuid4_id_generator_returns_parseable_uuid() -> None:
    generated = Uuid4IdGenerator().new_id()

    assert parse_uuid(generated) == UUID(generated)


def test_uuid4_id_generator_supports_prefix() -> None:
    generated = Uuid4IdGenerator(prefix="req_").new_id()

    assert generated.startswith("req_")
    assert parse_uuid(generated.removeprefix("req_")) == UUID(generated.removeprefix("req_"))


def test_sequence_id_generator_is_deterministic_for_tests() -> None:
    generator = SequenceIdGenerator(prefix="case-", start=7)

    assert new_id(generator) == "case-7"
    assert new_id(generator) == "case-8"


def test_sequence_id_generator_rejects_negative_start() -> None:
    with pytest.raises(ValueError, match="start must be >= 0"):
        SequenceIdGenerator(start=-1)
