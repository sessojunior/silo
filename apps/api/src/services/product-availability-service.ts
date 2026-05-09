import { db } from "@silo/database";
import {
  product,
  productActivity,
  productAvailabilityException,
} from "@silo/database/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { formatDate } from "@silo/engine/date";
import {
  SHIFT_CODES,
  checkSlotFit,
  getShiftSlot,
} from "@silo/engine/domain/scheduling";
import type {
  DayOfWeek,
  ProfessionalSchedule,
  ScheduleException,
  ShiftCode,
  TimeSlot,
} from "@silo/engine/domain/scheduling";

type ProductAvailabilityServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductAvailabilityServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
  retryAfterSeconds?: number;
  resetFlow?: boolean;
};

const success = <T>(data: T): ProductAvailabilityServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductAvailabilityServiceError, "ok" | "error" | "status">,
): ProductAvailabilityServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export const PRODUCT_AVAILABILITY_EXCEPTION_TYPES = ["holiday", "pause", "extra"] as const;

export type ProductAvailabilityExceptionType = (typeof PRODUCT_AVAILABILITY_EXCEPTION_TYPES)[number];

const isShiftCode = (value: string): value is ShiftCode =>
  (SHIFT_CODES as readonly string[]).includes(value);

const normalizeShiftCodes = (value: unknown): ShiftCode[] => {
  if (!Array.isArray(value)) return [...SHIFT_CODES];

  const normalized = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number") return String(item);
      return "";
    })
    .filter((item): item is ShiftCode => isShiftCode(item));

  return normalized.length > 0 ? normalized : [...SHIFT_CODES];
};

const buildTimeSlot = (date: string, turn: number): TimeSlot => {
  const start = new Date(`${date}T00:00:00`);
  start.setHours(turn, 0, 0, 0);

  return {
    start,
    end: new Date(start.getTime() + 6 * 60 * 60 * 1000),
  };
};

const isProductAvailabilityExceptionType = (
  value: string,
): value is ProductAvailabilityExceptionType => {
  return (PRODUCT_AVAILABILITY_EXCEPTION_TYPES as readonly string[]).includes(value);
};

const mapProductAvailabilityException = (
  row: Pick<typeof productAvailabilityException.$inferSelect, "date" | "description" | "type">,
): ScheduleException | null => {
  if (!isProductAvailabilityExceptionType(row.type)) return null;

  return {
    date: new Date(`${row.date}T00:00:00`),
    type: row.type,
    description: row.description ?? undefined,
  };
};

type ProductServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
  retryAfterSeconds?: number;
  resetFlow?: boolean;
};

const productSuccess = <T>(data: T): ProductServiceSuccess<T> => ({
  ok: true,
  data,
});

const productFailure = (
  error: string,
  status?: number,
  extra?: Omit<ProductServiceError, "ok" | "error" | "status">,
): ProductServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

export async function getProductActivityAvailability(params: {
  productId: string;
  date: string;
  turn: number;
  activityId?: string | null;
}): Promise<
  | ProductServiceSuccess<{
      requestedDate: string;
      requestedTurn: number;
      allowedTurns: ShiftCode[];
      fits: boolean;
      reason: "available" | "conflict" | "turn_not_allowed" | "product_unavailable";
      conflictCount: number;
      suggestedSlots: Array<{ date: string; turn: number }>;
    }>
  | ProductServiceError
> {
  const [foundProduct] = await db
    .select({ id: product.id, turns: product.turns, available: product.available })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return productFailure("Produto não encontrado.", 404);
  }

  const allowedTurns = normalizeShiftCodes(foundProduct.turns);
  if (!foundProduct.available) {
    return productSuccess({
      requestedDate: params.date,
      requestedTurn: params.turn,
      allowedTurns,
      fits: false,
      reason: "product_unavailable",
      conflictCount: 0,
      suggestedSlots: [],
    });
  }

  const requestedTurnCode = String(params.turn);
  const requestedTurnAllowed = allowedTurns.includes(requestedTurnCode as ShiftCode);

  const requestedSlot = buildTimeSlot(params.date, params.turn);
  const rangeEnd = formatDate(new Date(requestedSlot.start.getTime() + 7 * 24 * 60 * 60 * 1000));

  const activityRows = await db
    .select({ id: productActivity.id, date: productActivity.date, turn: productActivity.turn })
    .from(productActivity)
    .where(
      and(
        eq(productActivity.productId, params.productId),
        gte(productActivity.date, params.date),
        lte(productActivity.date, rangeEnd),
      ),
    );

  const blocks = activityRows
    .filter((row) => row.id !== params.activityId)
    .map((row) => {
      const turnCode = String(row.turn);
      if (!isShiftCode(turnCode)) return null;

      return {
        id: row.id,
        reason: "Atividade existente",
        slot: getShiftSlot(new Date(`${row.date}T00:00:00`), turnCode),
      };
    })
    .filter((block): block is { id: string; reason: string; slot: TimeSlot } => block !== null);

  const exceptionRows = await db
    .select({
      date: productAvailabilityException.date,
      type: productAvailabilityException.type,
      description: productAvailabilityException.description,
    })
    .from(productAvailabilityException)
    .where(
      and(
        eq(productAvailabilityException.productId, params.productId),
        gte(productAvailabilityException.date, params.date),
        lte(productAvailabilityException.date, rangeEnd),
      ),
    );

  const exceptions = exceptionRows
    .map((row) => mapProductAvailabilityException(row))
    .filter((exception): exception is ScheduleException => exception !== null);

  const professionalSchedule: ProfessionalSchedule = {
    professionalId: foundProduct.id,
    workSchedule: {
      shiftsPerDay: allowedTurns,
      workDays: ALL_DAYS,
    },
    blocks,
    exceptions,
  };

  const fitResult = checkSlotFit(requestedSlot, professionalSchedule);
  const reason: "available" | "conflict" | "turn_not_allowed" = !requestedTurnAllowed
    ? "turn_not_allowed"
    : fitResult.conflicts.length > 0
      ? "conflict"
      : "available";

  return productSuccess({
    requestedDate: params.date,
    requestedTurn: params.turn,
    allowedTurns,
    fits: reason === "available",
    reason,
    conflictCount: fitResult.conflicts.length,
    suggestedSlots: fitResult.suggestedSlots.map((slot) => ({
      date: formatDate(slot.start),
      turn: slot.start.getHours(),
    })),
  });
}

export async function listProductAvailabilityExceptions(params: {
  productId: string;
  from?: string;
  to?: string;
}): Promise<
  | ProductServiceSuccess<{
      items: Array<{
        id: string;
        productId: string;
        date: string;
        type: ProductAvailabilityExceptionType;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }>
  | ProductServiceError
> {
  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return productFailure("Produto não encontrado.", 404);
  }

  const filters = [eq(productAvailabilityException.productId, params.productId)];
  if (params.from) filters.push(gte(productAvailabilityException.date, params.from));
  if (params.to) filters.push(lte(productAvailabilityException.date, params.to));

  const rows = await db
    .select()
    .from(productAvailabilityException)
    .where(and(...filters))
    .orderBy(asc(productAvailabilityException.date), asc(productAvailabilityException.type));

  return productSuccess({
    items: rows
      .map((row) => {
        if (!isProductAvailabilityExceptionType(row.type)) return null;

        return {
          id: row.id,
          productId: row.productId,
          date: row.date,
          type: row.type,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      })
      .filter(
        (exception): exception is {
          id: string;
          productId: string;
          date: string;
          type: ProductAvailabilityExceptionType;
          description: string | null;
          createdAt: Date;
          updatedAt: Date;
        } => exception !== null,
      ),
  });
}

export async function upsertProductAvailabilityException(params: {
  productId: string;
  date: string;
  type: ProductAvailabilityExceptionType;
  description?: string | null;
}): Promise<
  | ProductServiceSuccess<{
      action: "created" | "updated";
      exception: typeof productAvailabilityException.$inferSelect;
    }>
  | ProductServiceError
> {
  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return productFailure("Produto não encontrado.", 404);
  }

  const [existing] = await db
    .select({ id: productAvailabilityException.id })
    .from(productAvailabilityException)
    .where(
      and(
        eq(productAvailabilityException.productId, params.productId),
        eq(productAvailabilityException.date, params.date),
        eq(productAvailabilityException.type, params.type),
      ),
    )
    .limit(1);

  const [exception] = await db
    .insert(productAvailabilityException)
    .values({
      id: randomUUID(),
      productId: params.productId,
      date: params.date,
      type: params.type,
      description: params.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        productAvailabilityException.productId,
        productAvailabilityException.date,
        productAvailabilityException.type,
      ],
      set: {
        description: params.description ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!exception) {
    return productFailure("Erro ao salvar exceção de disponibilidade.", 500);
  }

  return productSuccess({
    action: existing ? "updated" : "created",
    exception,
  });
}

export async function deleteProductAvailabilityException(id: string): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  const [existing] = await db
    .select({ id: productAvailabilityException.id })
    .from(productAvailabilityException)
    .where(eq(productAvailabilityException.id, id))
    .limit(1);

  if (!existing) {
    return productFailure("Exceção não encontrada.", 404);
  }

  await db.delete(productAvailabilityException).where(eq(productAvailabilityException.id, id));

  return productSuccess(null);
}