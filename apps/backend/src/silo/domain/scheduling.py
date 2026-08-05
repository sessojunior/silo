from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal, TypeAlias

ShiftCode: TypeAlias = Literal["0", "6", "12", "18"]
DayOfWeek: TypeAlias = Literal[0, 1, 2, 3, 4, 5, 6]

SHIFT_CODES: tuple[ShiftCode, ...] = ("0", "6", "12", "18")
SHIFT_START_HOURS: dict[ShiftCode, int] = {"0": 0, "6": 6, "12": 12, "18": 18}
SHIFT_DURATION_HOURS = 6


@dataclass(frozen=True, slots=True)
class TimeSlot:
    start: datetime
    end: datetime


@dataclass(frozen=True, slots=True)
class WorkSchedule:
    shifts_per_day: list[ShiftCode]
    work_days: list[DayOfWeek]


@dataclass(frozen=True, slots=True)
class ScheduleBlock:
    id: str
    reason: str
    slot: TimeSlot


@dataclass(frozen=True, slots=True)
class ScheduleException:
    date: datetime
    type: Literal["holiday", "pause", "extra"]
    description: str | None = None


@dataclass(frozen=True, slots=True)
class ProfessionalSchedule:
    professional_id: str
    work_schedule: WorkSchedule
    blocks: list[ScheduleBlock]
    exceptions: list[ScheduleException]


@dataclass(frozen=True, slots=True)
class SchedulingConflict:
    professional_id: str
    requested_slot: TimeSlot
    conflicting_block: ScheduleBlock


@dataclass(frozen=True, slots=True)
class SlotFitResult:
    fits: bool
    conflicts: list[SchedulingConflict]
    suggested_slots: list[TimeSlot]


def get_shift_slot(date_value: datetime, shift: ShiftCode) -> TimeSlot:
    start = date_value.replace(
        hour=SHIFT_START_HOURS[shift],
        minute=0,
        second=0,
        microsecond=0,
    )
    end = start + timedelta(hours=SHIFT_DURATION_HOURS)
    return TimeSlot(start=start, end=end)


def get_day_slots(date_value: datetime, schedule: WorkSchedule) -> list[TimeSlot]:
    day_of_week = date_value.weekday()
    if day_of_week not in schedule.work_days:
        return []
    return [get_shift_slot(date_value, shift) for shift in schedule.shifts_per_day]


def slots_overlap(left: TimeSlot, right: TimeSlot) -> bool:
    return left.start < right.end and left.end > right.start


def is_exception_day(date_value: datetime, exceptions: list[ScheduleException]) -> bool:
    for exception in exceptions:
        if exception.type not in {"holiday", "pause"}:
            continue
        if (
            exception.date.year == date_value.year
            and exception.date.month == date_value.month
            and exception.date.day == date_value.day
        ):
            return True
    return False


def get_available_slots(
    date_value: datetime,
    schedule: WorkSchedule,
    exceptions: list[ScheduleException],
    existing_blocks: list[TimeSlot],
) -> list[TimeSlot]:
    if is_exception_day(date_value, exceptions):
        return []

    return [
        slot
        for slot in get_day_slots(date_value, schedule)
        if not any(slots_overlap(slot, block) for block in existing_blocks)
    ]


def get_available_slots_in_range(
    from_date: datetime,
    to_date: datetime,
    schedule: WorkSchedule,
    exceptions: list[ScheduleException],
    existing_blocks: list[TimeSlot],
) -> list[TimeSlot]:
    result: list[TimeSlot] = []
    current = from_date.replace(hour=0, minute=0, second=0, microsecond=0)

    while current <= to_date:
        result.extend(get_available_slots(current, schedule, exceptions, existing_blocks))
        current = current + timedelta(days=1)

    return result


def check_slot_fit(requested: TimeSlot, professional: ProfessionalSchedule) -> SlotFitResult:
    block_conflicts = [
        block
        for block in professional.blocks
        if slots_overlap(requested, block.slot)
    ]
    conflicts = [
        SchedulingConflict(
            professional_id=professional.professional_id,
            requested_slot=requested,
            conflicting_block=block,
        )
        for block in block_conflicts
    ]

    if is_exception_day(requested.start, professional.exceptions):
        conflicts.append(
            SchedulingConflict(
                professional_id=professional.professional_id,
                requested_slot=requested,
                conflicting_block=ScheduleBlock(
                    id=f"exception-{requested.start.isoformat()}",
                    reason="Exceção de disponibilidade",
                    slot=requested,
                ),
            )
        )

    if not conflicts:
        return SlotFitResult(fits=True, conflicts=[], suggested_slots=[])

    suggested_slots = get_available_slots_in_range(
        requested.start,
        requested.start + timedelta(days=7),
        professional.work_schedule,
        professional.exceptions,
        [block.slot for block in professional.blocks],
    )[:5]

    return SlotFitResult(fits=False, conflicts=conflicts, suggested_slots=suggested_slots)


def detect_conflicts(
    slots: list[dict[str, object]],
) -> list[SchedulingConflict]:
    conflicts: list[SchedulingConflict] = []
    for item in slots:
        slot = item["slot"]
        professional = item["professional"]
        if not isinstance(slot, TimeSlot) or not isinstance(professional, ProfessionalSchedule):
            continue
        conflicts.extend(check_slot_fit(slot, professional).conflicts)
    return conflicts
