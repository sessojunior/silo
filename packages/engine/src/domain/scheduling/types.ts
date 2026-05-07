// Tipos base para o módulo técnico de turnos e disponibilidade

export const SHIFT_CODES = ["0", "6", "12", "18"] as const;

export type ShiftCode = (typeof SHIFT_CODES)[number];

export const SHIFT_START_HOURS: Record<ShiftCode, number> = {
  "0": 0,
  "6": 6,
  "12": 12,
  "18": 18,
};

export const SHIFT_DURATION_HOURS = 6;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface WorkSchedule {
  shiftsPerDay: ShiftCode[];
  workDays: DayOfWeek[];
}

export interface ScheduleBlock {
  id: string;
  reason: string;
  slot: TimeSlot;
}

export interface ScheduleException {
  date: Date;
  type: "holiday" | "pause" | "extra";
  description?: string;
}

export interface ProfessionalSchedule {
  professionalId: string;
  workSchedule: WorkSchedule;
  blocks: ScheduleBlock[];
  exceptions: ScheduleException[];
}

export interface SchedulingConflict {
  professionalId: string;
  requestedSlot: TimeSlot;
  conflictingBlock: ScheduleBlock;
}

export interface SlotFitResult {
  fits: boolean;
  conflicts: SchedulingConflict[];
  suggestedSlots: TimeSlot[];
}
