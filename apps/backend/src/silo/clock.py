from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID, uuid4


class Clock(Protocol):
    def now(self) -> datetime: ...


class IdGenerator(Protocol):
    def new_id(self) -> str: ...


@dataclass(frozen=True)
class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


@dataclass
class FrozenClock:
    current: datetime

    def __post_init__(self) -> None:
        self.current = ensure_utc(self.current)

    def now(self) -> datetime:
        return self.current

    def set(self, value: datetime) -> None:
        self.current = ensure_utc(value)

    def advance(self, delta: timedelta) -> datetime:
        self.current = self.current + delta
        return self.current


@dataclass(frozen=True)
class Uuid4IdGenerator:
    prefix: str = ""

    def new_id(self) -> str:
        generated = str(uuid4())
        if not self.prefix:
            return generated
        return f"{self.prefix}{generated}"


@dataclass
class SequenceIdGenerator:
    prefix: str = "test-"
    start: int = 1
    _next_value: int = field(init=False)

    def __post_init__(self) -> None:
        if self.start < 0:
            raise ValueError("start must be >= 0")
        self._next_value = self.start

    def new_id(self) -> str:
        value = self._next_value
        self._next_value += 1
        return f"{self.prefix}{value}"


SYSTEM_CLOCK = SystemClock()
UUID4_ID_GENERATOR = Uuid4IdGenerator()


def utc_now(clock: Clock = SYSTEM_CLOCK) -> datetime:
    return clock.now()


def new_id(generator: IdGenerator = UUID4_ID_GENERATOR) -> str:
    return generator.new_id()


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)


def parse_uuid(value: str) -> UUID:
    return UUID(value)
