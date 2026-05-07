import type { TimeSlot, ProfessionalSchedule, SchedulingConflict, SlotFitResult } from "./types";
import { slotsOverlap, getAvailableSlotsInRange, isExceptionDay } from "./availability";

/**
 * Verifica se um slot pode ser alocado para um profissional,
 * detectando todos os conflitos com bloqueios existentes.
 */
export function checkSlotFit(
  requested: TimeSlot,
  professional: ProfessionalSchedule,
): SlotFitResult {
  const blockConflicts = professional.blocks.filter((block) =>
    slotsOverlap(requested, block.slot),
  );

  const conflicts: SchedulingConflict[] = blockConflicts.map((block) => ({
    professionalId: professional.professionalId,
    requestedSlot: requested,
    conflictingBlock: block,
  }));

  if (isExceptionDay(requested.start, professional.exceptions)) {
    conflicts.push({
      professionalId: professional.professionalId,
      requestedSlot: requested,
      conflictingBlock: {
        id: `exception-${requested.start.toISOString()}`,
        reason: "Exceção de disponibilidade",
        slot: requested,
      },
    });
  }

  if (conflicts.length === 0) {
    return { fits: true, conflicts: [], suggestedSlots: [] };
  }

  // Sugere slots livres próximos ao solicitado (próximos 7 dias)
  const suggestedSlots = getAvailableSlotsInRange(
    requested.start,
    new Date(requested.start.getTime() + 7 * 24 * 60 * 60 * 1000),
    professional.workSchedule,
    professional.exceptions,
    professional.blocks.map((b) => b.slot),
  ).slice(0, 5);

  return { fits: false, conflicts, suggestedSlots };
}

/**
 * Detecta conflitos entre múltiplos slots de diferentes profissionais.
 */
export function detectConflicts(
  slots: Array<{ slot: TimeSlot; professional: ProfessionalSchedule }>,
): SchedulingConflict[] {
  const conflicts: SchedulingConflict[] = [];

  for (const { slot, professional } of slots) {
    const result = checkSlotFit(slot, professional);
    conflicts.push(...result.conflicts);
  }

  return conflicts;
}
