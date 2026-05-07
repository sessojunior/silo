import type { ShiftCode, TimeSlot, DayOfWeek, WorkSchedule, ScheduleException } from "./types";
import { SHIFT_START_HOURS, SHIFT_DURATION_HOURS } from "./types";

/**
 * Retorna os horários de início e fim de um turno em uma data específica.
 */
export function getShiftSlot(date: Date, shift: ShiftCode): TimeSlot {
  const start = new Date(date);
  start.setHours(SHIFT_START_HOURS[shift], 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + SHIFT_DURATION_HOURS);
  return { start, end };
}

/**
 * Retorna todos os slots de turno de um dia com base na escala de trabalho.
 */
export function getDaySlots(date: Date, schedule: WorkSchedule): TimeSlot[] {
  const dayOfWeek = date.getDay() as DayOfWeek;
  if (!schedule.workDays.includes(dayOfWeek)) return [];
  return schedule.shiftsPerDay.map((shift) => getShiftSlot(date, shift));
}

/**
 * Verifica se dois slots se sobrepõem.
 */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Verifica se uma data é uma exceção (feriado ou pausa) na escala.
 */
export function isExceptionDay(date: Date, exceptions: ScheduleException[]): boolean {
  return exceptions.some(
    (ex) =>
      (ex.type === "holiday" || ex.type === "pause") &&
      ex.date.getFullYear() === date.getFullYear() &&
      ex.date.getMonth() === date.getMonth() &&
      ex.date.getDate() === date.getDate(),
  );
}

/**
 * Retorna os slots disponíveis de um profissional em um dia,
 * desconsiderando exceções e bloqueios existentes.
 */
export function getAvailableSlots(
  date: Date,
  schedule: WorkSchedule,
  exceptions: ScheduleException[],
  existingBlocks: TimeSlot[],
): TimeSlot[] {
  if (isExceptionDay(date, exceptions)) return [];

  const daySlots = getDaySlots(date, schedule);
  return daySlots.filter(
    (slot) => !existingBlocks.some((block) => slotsOverlap(slot, block)),
  );
}

/**
 * Retorna slots disponíveis em um intervalo de datas.
 */
export function getAvailableSlotsInRange(
  from: Date,
  to: Date,
  schedule: WorkSchedule,
  exceptions: ScheduleException[],
  existingBlocks: TimeSlot[],
): TimeSlot[] {
  const result: TimeSlot[] = [];
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);

  while (current <= to) {
    const slots = getAvailableSlots(current, schedule, exceptions, existingBlocks);
    result.push(...slots);
    current.setDate(current.getDate() + 1);
  }

  return result;
}
