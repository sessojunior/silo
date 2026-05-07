import { db } from "@silo/database";
import {
  authUser,
  product,
  productAvailabilityException,
  productActivity,
  productActivityHistory,
  productContact,
  productDependency,
  productManual,
  contact,
  productProblem,
  productProblemCategory,
  productProblemImage,
  productSolution,
  productSolutionChecked,
  productSolutionImage,
} from "@silo/database/schema";
import { eq, like, ilike, asc, desc, inArray, and, isNull, sql, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { formatDate, formatDateBR } from "@silo/engine/date";
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
import { sendEmail } from "../infra/send-email.js";
import { getProductDataFlowPipelinesFromKafkaRest } from "../dataflow/kafka-data-flow-source.js";
import { recordProductActivityHistory } from "../domain/product-activity-history.js";

export function formatSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

export async function listProducts(opts: {
  slug?: string;
  name?: string;
  page?: number;
  limit?: number;
}) {
  const { slug, name, page = 1, limit = 40 } = opts;
  if (slug) {
    return db.select().from(product).where(eq(product.slug, slug)).limit(1);
  }
  const offset = (page - 1) * limit;
  const where = name ? like(product.name, `%${name}%`) : undefined;
  return where
    ? db.select().from(product).where(where).orderBy(asc(product.name)).limit(limit).offset(offset)
    : db.select().from(product).orderBy(asc(product.name)).limit(limit).offset(offset);
}

export async function createProduct(data: {
  name: string;
  slug?: string;
  available: boolean;
  priority: string;
  turns: ShiftCode[];
  description?: string | null;
  urlProductFlow?: string | null;
}) {
  const name = data.name.trim();
  const slug = formatSlug(data.slug || name);
  const existing = await db.select().from(product).where(like(product.slug, slug)).limit(1);
  if (existing.length > 0 && existing[0].slug === slug) {
    return { error: "Já existe um produto com este slug.", field: "name" };
  }
  await db.insert(product).values({
    id: randomUUID(),
    name,
    slug,
    available: data.available,
    priority: data.priority,
    turns: data.turns,
    description: data.description ?? null,
    urlProductFlow: data.urlProductFlow ?? null,
  });
  return { ok: true };
}

export async function updateProduct(data: {
  id: string;
  name: string;
  slug?: string;
  available: boolean;
  priority: string;
  turns: ShiftCode[];
  description?: string | null;
  urlProductFlow?: string | null;
}) {
  const name = data.name.trim();
  const slug = formatSlug(data.slug || name);
  const existing = await db.select().from(product).where(like(product.slug, slug)).limit(1);
  if (existing.length > 0 && existing[0].id !== data.id && existing[0].slug === slug) {
    return { error: "Já existe um produto com este slug." };
  }
  const result = await db
    .update(product)
    .set({ name, slug, available: data.available, priority: data.priority, turns: data.turns, description: data.description ?? null, urlProductFlow: data.urlProductFlow ?? null })
    .where(eq(product.id, data.id));
  if (!result.rowCount) return { error: "Produto não encontrado.", status: 404 };
  return { ok: true };
}

export async function appendProductFlowEntry(params: {
  productId?: string;
  slug?: string;
  payload?: unknown;
}) {
  const { productId, slug, payload } = params;
  const rows = await db
    .select({ id: product.id, dataProductFlow: product.dataProductFlow })
    .from(product)
    .where(productId ? eq(product.id, productId) : eq(product.slug, slug ?? ""))
    .limit(1);

  if (rows.length === 0) return { error: "Produto não encontrado.", status: 404 };

  const currentFlow = Array.isArray(rows[0].dataProductFlow) ? rows[0].dataProductFlow : [];
  const entry = { receivedAt: new Date().toISOString(), payload };
  const nextFlow = [...currentFlow, entry];

  await db.update(product).set({ dataProductFlow: nextFlow as unknown }).where(eq(product.id, rows[0].id));

  return { ok: true, entry };
}

export async function upsertProductActivity(params: {
  userId: string;
  productId: string;
  date: Date | string;
  turn: number;
  status: string;
  description?: string | null;
  intervention?: string | null;
  problemCategoryId?: string | null;
}): Promise<
  | { activity: typeof productActivity.$inferSelect; action: "created" | "updated" }
  | { error: string; status?: number }
> {
  const normalizedDate = formatDate(params.date);
  const [record] = await db
    .insert(productActivity)
    .values({
      id: randomUUID(),
      productId: params.productId,
      userId: params.userId,
      date: normalizedDate,
      turn: params.turn,
      status: params.status,
      description: params.description ?? null,
      intervention: params.intervention ?? null,
      problemCategoryId: params.problemCategoryId ?? null,
    })
    .onConflictDoUpdate({
      target: [productActivity.productId, productActivity.date, productActivity.turn],
      set: {
        status: params.status,
        description: params.description ?? null,
        intervention: params.intervention ?? null,
        problemCategoryId: params.problemCategoryId ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!record) {
    return { error: "Erro ao salvar atividade.", status: 500 };
  }

  const action = record.createdAt.getTime() === record.updatedAt.getTime() ? "created" : "updated";
  await recordProductActivityHistory({
    productActivityId: record.id,
    userId: params.userId,
    status: record.status,
    description: record.description,
    intervention: record.intervention,
  });

  return { activity: record, action };
}

export async function updateProductActivity(params: {
  userId: string;
  id: string;
  status: string;
  description?: string | null;
  intervention?: string | null;
  problemCategoryId?: string | null;
}): Promise<{ activity: typeof productActivity.$inferSelect } | { error: string; status?: number }> {
  const [updated] = await db
    .update(productActivity)
    .set({
      status: params.status,
      description: params.description ?? null,
      intervention: params.intervention ?? null,
      problemCategoryId: params.problemCategoryId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(productActivity.id, params.id))
    .returning();

  if (!updated) {
    return { error: "Atividade não encontrada.", status: 404 };
  }

  await recordProductActivityHistory({
    productActivityId: updated.id,
    userId: params.userId,
    status: updated.status,
    description: updated.description,
    intervention: updated.intervention,
  });

  return { activity: updated };
}

export async function getProductActivityAvailability(params: {
  productId: string;
  date: string;
  turn: number;
  activityId?: string | null;
}): Promise<
  | {
      requestedDate: string;
      requestedTurn: number;
      allowedTurns: ShiftCode[];
      fits: boolean;
      reason: "available" | "conflict" | "turn_not_allowed" | "product_unavailable";
      conflictCount: number;
      suggestedSlots: Array<{ date: string; turn: number }>;
    }
  | { error: string; status?: number }
> {
  const [foundProduct] = await db
    .select({ id: product.id, turns: product.turns, available: product.available })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return { error: "Produto não encontrado.", status: 404 };
  }

  const allowedTurns = normalizeShiftCodes(foundProduct.turns);
  if (!foundProduct.available) {
    return {
      requestedDate: params.date,
      requestedTurn: params.turn,
      allowedTurns,
      fits: false,
      reason: "product_unavailable",
      conflictCount: 0,
      suggestedSlots: []
    };
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

  return {
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
  };
}

export async function listProductAvailabilityExceptions(params: {
  productId: string;
  from?: string;
  to?: string;
}): Promise<
  | {
      items: Array<{
        id: string;
        productId: string;
        date: string;
        type: ProductAvailabilityExceptionType;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }
  | { error: string; status?: number }
> {
  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return { error: "Produto não encontrado.", status: 404 };
  }

  const filters = [eq(productAvailabilityException.productId, params.productId)];
  if (params.from) filters.push(gte(productAvailabilityException.date, params.from));
  if (params.to) filters.push(lte(productAvailabilityException.date, params.to));

  const rows = await db
    .select()
    .from(productAvailabilityException)
    .where(and(...filters))
    .orderBy(asc(productAvailabilityException.date), asc(productAvailabilityException.type));

  return {
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
  };
}

export async function upsertProductAvailabilityException(params: {
  productId: string;
  date: string;
  type: ProductAvailabilityExceptionType;
  description?: string | null;
}): Promise<
  | {
      action: "created" | "updated";
      exception: typeof productAvailabilityException.$inferSelect;
    }
  | { error: string; status?: number }
> {
  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, params.productId))
    .limit(1);

  if (!foundProduct) {
    return { error: "Produto não encontrado.", status: 404 };
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
    return { error: "Erro ao salvar exceção de disponibilidade.", status: 500 };
  }

  return {
    action: existing ? "updated" : "created",
    exception,
  };
}

export async function deleteProductAvailabilityException(id: string) {
  const [existing] = await db
    .select({ id: productAvailabilityException.id })
    .from(productAvailabilityException)
    .where(eq(productAvailabilityException.id, id))
    .limit(1);

  if (!existing) {
    return { error: "Exceção não encontrada.", status: 404 };
  }

  await db.delete(productAvailabilityException).where(eq(productAvailabilityException.id, id));

  return { ok: true };
}

export async function deleteProduct(id: string) {
  const existing = await db.select().from(product).where(eq(product.id, id)).limit(1);
  if (existing.length === 0) return { error: "Produto não encontrado.", status: 404 };

  await db.transaction(async (tx) => {
    const activities = await tx.select({ id: productActivity.id }).from(productActivity).where(eq(productActivity.productId, id));
    const activityIds = activities.map((a) => a.id);

    if (activityIds.length > 0) {
      await tx.delete(productActivityHistory).where(inArray(productActivityHistory.productActivityId, activityIds));
    }
    await tx.delete(productActivity).where(eq(productActivity.productId, id));

    const problems = await tx.select({ id: productProblem.id }).from(productProblem).where(eq(productProblem.productId, id));
    const problemIds = problems.map((p) => p.id);

    if (problemIds.length > 0) {
      const solutions = await tx.select({ id: productSolution.id }).from(productSolution).where(inArray(productSolution.productProblemId, problemIds));
      const solutionIds = solutions.map((s) => s.id);

      if (solutionIds.length > 0) {
        await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutionIds));
        await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds));
      }
      await tx.delete(productSolution).where(inArray(productSolution.productProblemId, problemIds));
      await tx.delete(productProblemImage).where(inArray(productProblemImage.productProblemId, problemIds));
      await tx.delete(productProblem).where(eq(productProblem.productId, id));
    }

    await tx.delete(productDependency).where(eq(productDependency.productId, id));
    await tx.delete(productManual).where(eq(productManual.productId, id));
    await tx.delete(productContact).where(eq(productContact.productId, id));
    await tx.delete(product).where(eq(product.id, id));
  });

  return { ok: true };
}

type ProductProblemRecord = typeof productProblem.$inferSelect;

type ProductProblemListItem = ProductProblemRecord & {
  categoryName: string | null;
  categoryColor: string | null;
  userName: string | null;
};

export async function listProductProblems(params: {
  slug: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ProductProblemListItem[] } | DependencyOperationError> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.slug, params.slug))
    .limit(1);

  if (!foundProduct) {
    return { error: "Produto não encontrado.", status: 404 };
  }

  const problems = await db
    .select({
      id: productProblem.id,
      productId: productProblem.productId,
      userId: productProblem.userId,
      title: productProblem.title,
      description: productProblem.description,
      problemCategoryId: productProblem.problemCategoryId,
      categoryName: productProblemCategory.name,
      categoryColor: productProblemCategory.color,
      createdAt: productProblem.createdAt,
      updatedAt: productProblem.updatedAt,
      userName: authUser.name,
    })
    .from(productProblem)
    .leftJoin(authUser, eq(productProblem.userId, authUser.id))
    .leftJoin(productProblemCategory, eq(productProblem.problemCategoryId, productProblemCategory.id))
    .where(eq(productProblem.productId, foundProduct.id))
    .orderBy(desc(productProblem.createdAt))
    .limit(limit)
    .offset(offset);

  return { items: problems };
}

export async function createProductProblem(data: {
  productId: string;
  userId: string;
  title: string;
  description: string;
  problemCategoryId: string;
}): Promise<{ ok: true } | DependencyOperationError> {
  const [category] = await db
    .select({ id: productProblemCategory.id })
    .from(productProblemCategory)
    .where(eq(productProblemCategory.id, data.problemCategoryId))
    .limit(1);

  if (!category) {
    return { error: "Categoria não encontrada.", status: 400 };
  }

  await db.insert(productProblem).values({
    id: randomUUID(),
    productId: data.productId,
    userId: data.userId,
    title: data.title.trim(),
    description: data.description.trim(),
    problemCategoryId: data.problemCategoryId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { ok: true };
}

export async function updateProductProblem(data: {
  id: string;
  title: string;
  description: string;
  problemCategoryId: string;
}): Promise<{ ok: true } | DependencyOperationError> {
  const [updated] = await db
    .update(productProblem)
    .set({
      title: data.title.trim(),
      description: data.description.trim(),
      problemCategoryId: data.problemCategoryId,
      updatedAt: new Date(),
    })
    .where(eq(productProblem.id, data.id))
    .returning();

  if (!updated) {
    return { error: "Problema não encontrado.", status: 404 };
  }

  return { ok: true };
}

export async function deleteProductProblem(id: string): Promise<{ ok: true } | DependencyOperationError> {
  await db.transaction(async (tx) => {
    const solutions = await tx.select().from(productSolution).where(eq(productSolution.productProblemId, id));
    const solutionIds = solutions.map((solution) => solution.id);

    if (solutionIds.length > 0) {
      await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutionIds));
      await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds));
      await tx.delete(productSolution).where(eq(productSolution.productProblemId, id));
    }

    await tx.delete(productProblemImage).where(eq(productProblemImage.productProblemId, id));
    await tx.delete(productProblem).where(eq(productProblem.id, id));
  });

  return { ok: true };
}

type ProductProblemImageRecord = typeof productProblemImage.$inferSelect;

export async function listProductProblemImages(problemId: string): Promise<{ items: ProductProblemImageRecord[] }> {
  const items = await db
    .select()
    .from(productProblemImage)
    .where(eq(productProblemImage.productProblemId, problemId));

  return { items };
}

export async function createProductProblemImage(data: {
  productProblemId: string;
  image: string;
  description?: string;
}): Promise<{ image: ProductProblemImageRecord }> {
  const [image] = await db
    .insert(productProblemImage)
    .values({
      id: randomUUID(),
      productProblemId: data.productProblemId,
      image: data.image,
      description: data.description ?? "",
    })
    .returning();

  return { image };
}

export async function deleteProductProblemImage(id: string): Promise<{ image: ProductProblemImageRecord } | DependencyOperationError> {
  const [image] = await db
    .select()
    .from(productProblemImage)
    .where(eq(productProblemImage.id, id))
    .limit(1);

  if (!image) {
    return { error: "Imagem não encontrada.", status: 404 };
  }

  await db.delete(productProblemImage).where(eq(productProblemImage.id, id));

  return { image };
}

type ProductActivityHistoryRecord = typeof productActivityHistory.$inferSelect;

type ProductActivityHistoryItem = Pick<
  ProductActivityHistoryRecord,
  "id" | "status" | "description" | "intervention" | "createdAt"
> & {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

export async function listProductActivityHistory(params: {
  productId: string;
  date: Date | string | null | undefined;
  turn: number | string | null | undefined;
}): Promise<{ history: ProductActivityHistoryItem[] } | { error: string; status?: number }> {
  const date = typeof params.date === "string" ? params.date.trim() : params.date ? formatDate(params.date) : "";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Data inválida.", status: 400 };
  }

  const turn = typeof params.turn === "string" ? Number(params.turn) : params.turn;
  if (turn === null || turn === undefined || !Number.isFinite(turn)) {
    return { error: "Turno inválido.", status: 400 };
  }

  const [currentActivity] = await db
    .select({ id: productActivity.id })
    .from(productActivity)
    .where(
      and(
        eq(productActivity.productId, params.productId),
        eq(productActivity.date, date),
        eq(productActivity.turn, turn),
      ),
    )
    .limit(1);

  if (!currentActivity) {
    return { history: [] };
  }

  const history = await db
    .select({
      id: productActivityHistory.id,
      status: productActivityHistory.status,
      description: productActivityHistory.description,
      intervention: productActivityHistory.intervention,
      createdAt: productActivityHistory.createdAt,
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        image: authUser.image,
      },
    })
    .from(productActivityHistory)
    .innerJoin(authUser, eq(productActivityHistory.userId, authUser.id))
    .where(eq(productActivityHistory.productActivityId, currentActivity.id))
    .orderBy(desc(productActivityHistory.createdAt));

  return { history };
}

type ProductActivityPendingEmailRecipient = Pick<
  typeof authUser.$inferSelect,
  "id" | "name" | "email" | "image"
>;

export async function listProductActivityPendingEmailRecipients(): Promise<{
  items: ProductActivityPendingEmailRecipient[];
  total: number;
}> {
  const items = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image })
    .from(authUser)
    .where(eq(authUser.isActive, true))
    .orderBy(asc(authUser.name));

  return { items, total: items.length };
}

export async function sendProductActivityPendingEmail(data: {
  productId: string;
  date: string;
  turn: number;
  status: string;
  incidentName?: string | null;
  recipientUserIds: string[];
  message: string;
}): Promise<{ sent: number } | { error: string; status?: number; data?: { sent: number; failed: number } }> {
  const [productRecord] = await db
    .select({ id: product.id, name: product.name })
    .from(product)
    .where(eq(product.id, data.productId))
    .limit(1);

  if (!productRecord) {
    return { error: "Produto não encontrado.", status: 404 };
  }

  const recipientUserIds = Array.from(new Set(data.recipientUserIds));
  const recipients = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email })
    .from(authUser)
    .where(and(inArray(authUser.id, recipientUserIds), eq(authUser.isActive, true)));

  if (recipients.length !== recipientUserIds.length) {
    return { error: "Um ou mais destinatários não encontrados ou inativos.", status: 400 };
  }

  const incidentSuffix = data.incidentName ? ` - ${data.incidentName}` : "";
  const subject = `Pendências do turno - ${productRecord.name}${incidentSuffix} - ${data.status} - ${formatDateBR(data.date)} ${data.turn}h`;
  const results = await Promise.all(
    recipients.map(async (recipient) => ({
      recipient,
      result: await sendEmail({ to: recipient.email, subject, text: data.message }),
    })),
  );

  const failures = results.filter(({ result }) => "error" in result);
  if (failures.length > 0) {
    return {
      error: "Erro ao enviar e-mail para destinatário(s).",
      status: 502,
      data: { sent: recipients.length - failures.length, failed: failures.length },
    };
  }

  return { sent: recipients.length };
}

type ProductContactListItem = {
  id: string;
  name: string | null;
  role: string | null;
  team: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  active: boolean;
  associationId: string;
  createdAt: Date;
};

export async function listProductContacts(productId: string): Promise<{ contacts: ProductContactListItem[] }> {
  const contacts = await db
    .select({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      team: contact.team,
      email: contact.email,
      phone: contact.phone,
      image: contact.image,
      active: contact.active,
      associationId: productContact.id,
      createdAt: productContact.createdAt,
    })
    .from(productContact)
    .innerJoin(contact, eq(productContact.contactId, contact.id))
    .where(and(eq(productContact.productId, productId), eq(contact.active, true)))
    .orderBy(productContact.createdAt);

  return { contacts };
}

export async function replaceProductContacts(data: {
  productId: string;
  contactIds: string[];
}): Promise<{ ok: true }> {
  const contactIds = Array.from(new Set(data.contactIds));

  await db.delete(productContact).where(eq(productContact.productId, data.productId));

  if (contactIds.length > 0) {
    await db.insert(productContact).values(
      contactIds.map((contactId) => ({
        id: randomUUID(),
        productId: data.productId,
        contactId,
      })),
    );
  }

  return { ok: true };
}

export async function deleteProductContactAssociation(associationId: string): Promise<{ ok: true } | { error: string; status?: number }> {
  const [association] = await db
    .select({ id: productContact.id })
    .from(productContact)
    .where(eq(productContact.id, associationId))
    .limit(1);

  if (!association) {
    return { error: "Associação não encontrada.", status: 404 };
  }

  await db.delete(productContact).where(eq(productContact.id, associationId));

  return { ok: true };
}

type ProductDataFlowPipeline = Awaited<ReturnType<typeof getProductDataFlowPipelinesFromKafkaRest>>[number];

export async function listProductDataFlowPipelines(params: {
  productSlug: string | null | undefined;
  date?: string | null | undefined;
  turn?: string | null | undefined;
}): Promise<{ pipelines: ProductDataFlowPipeline[] } | { error: string; status?: number }> {
  const productSlug = String(params.productSlug ?? "").trim();
  if (!productSlug) {
    return { error: "Produto inválido.", status: 400 };
  }

  const pipelines = await getProductDataFlowPipelinesFromKafkaRest({
    slug: productSlug,
    date: params.date,
    turn: params.turn,
  });

  return { pipelines };
}

type ProductProblemCategoryRecord = typeof productProblemCategory.$inferSelect;

export async function listProductProblemCategories(search: string): Promise<{ items: ProductProblemCategoryRecord[] }> {
  const items = await db
    .select()
    .from(productProblemCategory)
    .where(search ? ilike(productProblemCategory.name, `%${search}%`) : undefined)
    .orderBy(productProblemCategory.name);

  return { items };
}

export async function createProductProblemCategory(data: {
  name: string;
  color?: string | null;
}): Promise<{ category: ProductProblemCategoryRecord } | DependencyOperationError> {
  const name = data.name.trim();
  const [existing] = await db
    .select()
    .from(productProblemCategory)
    .where(eq(productProblemCategory.name, name))
    .limit(1);

  if (existing) {
    return { error: "Categoria já existe.", status: 400 };
  }

  const category = {
    id: randomUUID(),
    name,
    color: data.color || null,
  };

  const [createdCategory] = await db.insert(productProblemCategory).values(category).returning();

  return { category: createdCategory };
}

export async function updateProductProblemCategory(data: {
  id: string;
  name: string;
  color?: string | null;
}): Promise<{ ok: true } | DependencyOperationError> {
  const name = data.name.trim();
  const [duplicate] = await db
    .select()
    .from(productProblemCategory)
    .where(eq(productProblemCategory.name, name))
    .limit(1);

  if (duplicate && duplicate.id !== data.id) {
    return { error: "Já existe outra categoria com esse nome.", status: 400 };
  }

  const [updated] = await db
    .update(productProblemCategory)
    .set({ name, color: data.color || null, updatedAt: new Date() })
    .where(eq(productProblemCategory.id, data.id))
    .returning();

  if (!updated) {
    return { error: "Categoria não encontrada.", status: 404 };
  }

  return { ok: true };
}

export async function deleteProductProblemCategory(id: string): Promise<{ ok: true } | DependencyOperationError> {
  const [existing] = await db
    .select({ id: productProblemCategory.id })
    .from(productProblemCategory)
    .where(eq(productProblemCategory.id, id))
    .limit(1);

  if (!existing) {
    return { error: "Categoria não encontrada.", status: 404 };
  }

  await db.delete(productProblemCategory).where(eq(productProblemCategory.id, id));

  return { ok: true };
}

type ProductManualRecord = typeof productManual.$inferSelect;

export async function getProductManual(params: {
  productSlug?: string;
  productId?: string;
}): Promise<{ manual: ProductManualRecord | null } | DependencyOperationError> {
  if (params.productSlug) {
    const [row] = await db
      .select({ manual: productManual })
      .from(product)
      .leftJoin(productManual, eq(product.id, productManual.productId))
      .where(eq(product.slug, params.productSlug))
      .limit(1);

    return { manual: row?.manual ?? null };
  }

  if (params.productId) {
    const [row] = await db
      .select()
      .from(productManual)
      .where(eq(productManual.productId, params.productId))
      .limit(1);

    return { manual: row ?? null };
  }

  return { error: "productSlug ou productId é obrigatório", status: 400 };
}

export async function upsertProductManual(data: {
  productId: string;
  description: string;
}): Promise<{ manual: ProductManualRecord } | DependencyOperationError> {
  const [existingProduct] = await db
    .select()
    .from(product)
    .where(eq(product.id, data.productId))
    .limit(1);

  if (!existingProduct) {
    return { error: "Produto não encontrado", status: 404 };
  }

  const [existingManual] = await db
    .select()
    .from(productManual)
    .where(eq(productManual.productId, data.productId))
    .limit(1);

  if (existingManual) {
    const [manual] = await db
      .update(productManual)
      .set({ description: data.description, updatedAt: new Date() })
      .where(eq(productManual.productId, data.productId))
      .returning();

    return { manual };
  }

  const [manual] = await db
    .insert(productManual)
    .values({
      id: randomUUID(),
      productId: data.productId,
      description: data.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return { manual };
}

type ProductDependencyRecord = typeof productDependency.$inferSelect;

export type ProductDependencyTreeItem = ProductDependencyRecord & {
  children?: ProductDependencyTreeItem[];
};

export type ProductDependencyCreateInput = {
  productId: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  parentId?: string | null;
};

export type ProductDependencyUpdateInput = {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  parentId?: string | null;
  newPosition?: number;
};

export type ProductDependencyReorderItem = {
  id: string;
  parentId: string | null;
  treePath: string;
  treeDepth: number;
  sortKey: string;
};

const calculateTreePath = (parentPath: string | null, position: number): string => {
  return parentPath ? `${parentPath}/${position}` : `/${position}`;
};

const calculateSortKey = (parentSortKey: string | null, position: number): string => {
  return parentSortKey ? `${parentSortKey}.${position.toString().padStart(3, "0")}` : position.toString().padStart(3, "0");
};

const calculateTreeDepth = (parentDepth: number | null): number => {
  return parentDepth !== null ? parentDepth + 1 : 0;
};

const buildDependencyTree = (
  items: ProductDependencyRecord[],
  parentId: string | null = null,
): ProductDependencyTreeItem[] => {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item,
      children: buildDependencyTree(items, item.id),
    }));
};

export async function listProductDependencies(productId: string) {
  const dependencies = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.productId, productId))
    .orderBy(productDependency.sortKey);

  return buildDependencyTree(dependencies);
}

type DependencyOperationError = {
  error: string;
  status?: number;
};

type ProductSolutionImageRecord = typeof productSolutionImage.$inferSelect;

type ProductSolutionListItem = {
  id: string;
  replyId: string | null;
  date: Date;
  description: string;
  verified: boolean;
  user: {
    id: string;
    name: string;
    image: string;
  };
  images: ProductSolutionImageRecord[];
  isMine: boolean;
};

export async function listProductSolutions(problemId: string): Promise<{ items: ProductSolutionListItem[] }> {
  const solutions = await db
    .select()
    .from(productSolution)
    .where(eq(productSolution.productProblemId, problemId))
    .orderBy(desc(productSolution.createdAt), desc(productSolution.id));

  const userIds = [...new Set(solutions.map((solution) => solution.userId))];
  const users = userIds.length ? await db.select().from(authUser).where(inArray(authUser.id, userIds)) : [];
  const checked = solutions.length
    ? await db.select().from(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutions.map((solution) => solution.id)))
    : [];
  const checkedIds = new Set(checked.map((item) => item.productSolutionId));
  const solutionIds = solutions.map((solution) => solution.id);
  const images = solutionIds.length
    ? await db.select().from(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds))
    : [];

  const items = solutions.map((solution) => {
    const user = users.find((item) => item.id === solution.userId);

    return {
      id: solution.id,
      replyId: solution.replyId,
      date: solution.createdAt,
      description: solution.description,
      verified: checkedIds.has(solution.id),
      user: user
        ? { id: solution.userId, name: user.name ?? "", image: "/images/profile.png" }
        : { id: solution.userId, name: "Usuário desconhecido", image: "/images/profile.png" },
      images: images.filter((image) => image.productSolutionId === solution.id),
      isMine: false,
    } satisfies ProductSolutionListItem;
  });

  return { items };
}

export async function createProductSolution(data: {
  userId: string;
  problemId: string;
  description: string;
  replyId?: string | null;
  imageUrl?: string | null;
}): Promise<{ ok: true }> {
  const solutionId = randomUUID();

  await db.insert(productSolution).values({
    id: solutionId,
    userId: data.userId,
    productProblemId: data.problemId,
    description: data.description,
    replyId: data.replyId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (data.imageUrl) {
    await db.insert(productSolutionImage).values({
      id: randomUUID(),
      productSolutionId: solutionId,
      image: data.imageUrl,
      description: "",
    });
  }

  return { ok: true };
}

export async function updateProductSolution(data: {
  userId: string;
  id: string;
  description: string;
  imageUrl?: string | null;
  removeImage?: boolean;
}): Promise<{ ok: true } | DependencyOperationError> {
  const [solution] = await db.select().from(productSolution).where(eq(productSolution.id, data.id)).limit(1);

  if (!solution || solution.userId !== data.userId) {
    return { error: "Permissão negada.", status: 403 };
  }

  await db.update(productSolution).set({ description: data.description, updatedAt: new Date() }).where(eq(productSolution.id, data.id));

  if (data.imageUrl) {
    await db.delete(productSolutionImage).where(eq(productSolutionImage.productSolutionId, data.id));
    await db.insert(productSolutionImage).values({
      id: randomUUID(),
      productSolutionId: data.id,
      image: data.imageUrl,
      description: "",
    });
  } else if (data.removeImage) {
    await db.delete(productSolutionImage).where(eq(productSolutionImage.productSolutionId, data.id));
  }

  return { ok: true };
}

export async function deleteProductSolution(data: {
  userId: string;
  id: string;
}): Promise<{ ok: true } | DependencyOperationError> {
  const [solution] = await db.select().from(productSolution).where(eq(productSolution.id, data.id)).limit(1);

  if (!solution || solution.userId !== data.userId) {
    return { error: "Permissão negada.", status: 403 };
  }

  await db.transaction(async (tx) => {
    const getAllChildReplies = async (parentId: string): Promise<string[]> => {
      const directReplies = await tx.select().from(productSolution).where(eq(productSolution.replyId, parentId));
      let all = directReplies.map((reply) => reply.id);

      for (const reply of directReplies) {
        all = all.concat(await getAllChildReplies(reply.id));
      }

      return all;
    };

    const childReplyIds = await getAllChildReplies(data.id);
    const allIds = [data.id, ...childReplyIds];

    await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, allIds));
    await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, allIds));
    await tx.delete(productSolution).where(inArray(productSolution.id, allIds));
  });

  return { ok: true };
}

export async function countProductSolutions(problemIds: string[]): Promise<Record<string, number>> {
  const result = await db
    .select({ problemId: productSolution.productProblemId, count: sql<number>`COUNT(${productSolution.id})` })
    .from(productSolution)
    .where(inArray(productSolution.productProblemId, problemIds))
    .groupBy(productSolution.productProblemId);

  const counts: Record<string, number> = {};
  problemIds.forEach((id) => {
    counts[id] = 0;
  });

  result.forEach((row) => {
    counts[row.problemId] = Number(row.count);
  });

  return counts;
}

export async function getProductSolutionsSummary(productSlug: string): Promise<{ totalSolutions: number; lastUpdated: Date | null } | DependencyOperationError> {
  const [result] = await db
    .select({
      totalSolutions: sql<number>`COUNT(${productSolution.id})`,
      lastUpdated: sql<Date | null>`MAX(GREATEST(${productProblem.updatedAt}, COALESCE(${productSolution.updatedAt}, ${productProblem.updatedAt})))`,
    })
    .from(product)
    .leftJoin(productProblem, eq(productProblem.productId, product.id))
    .leftJoin(productSolution, eq(productSolution.productProblemId, productProblem.id))
    .where(eq(product.slug, productSlug))
    .groupBy(product.id);

  if (!result) {
    return { totalSolutions: 0, lastUpdated: null };
  }

  return { totalSolutions: Number(result.totalSolutions) || 0, lastUpdated: result.lastUpdated };
}

export async function listProductSolutionImages(solutionId: string): Promise<{ items: ProductSolutionImageRecord[] }> {
  const items = await db
    .select()
    .from(productSolutionImage)
    .where(eq(productSolutionImage.productSolutionId, solutionId));

  return { items };
}

export async function createProductSolutionImage(data: {
  productSolutionId: string;
  image: string;
  description?: string;
}): Promise<{ image: ProductSolutionImageRecord }> {
  const [image] = await db
    .insert(productSolutionImage)
    .values({
      id: randomUUID(),
      productSolutionId: data.productSolutionId,
      image: data.image,
      description: data.description ?? "",
    })
    .returning();

  return { image };
}

export async function deleteProductSolutionImage(id: string): Promise<{ image: ProductSolutionImageRecord } | DependencyOperationError> {
  const [image] = await db
    .select()
    .from(productSolutionImage)
    .where(eq(productSolutionImage.id, id))
    .limit(1);

  if (!image) {
    return { error: "Imagem não encontrada.", status: 404 };
  }

  await db.delete(productSolutionImage).where(eq(productSolutionImage.id, id));

  return { image };
}

export async function createProductDependency(
  data: ProductDependencyCreateInput,
): Promise<{ dependency: ProductDependencyRecord } | DependencyOperationError> {
  const siblings = await db
    .select()
    .from(productDependency)
    .where(
      and(
        eq(productDependency.productId, data.productId),
        data.parentId
          ? eq(productDependency.parentId, data.parentId)
          : isNull(productDependency.parentId),
      ),
    );

  const nextPosition = siblings.length;
  let parentData: ProductDependencyRecord | null = null;

  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.id, data.parentId))
      .limit(1);
    parentData = parent ?? null;
  }

  const treePath = calculateTreePath(parentData?.treePath ?? null, nextPosition);
  const sortKey = calculateSortKey(parentData?.sortKey ?? null, nextPosition);
  const treeDepth = calculateTreeDepth(parentData?.treeDepth ?? null);

  const [dependency] = await db
    .insert(productDependency)
    .values({
      id: randomUUID(),
      productId: data.productId,
      name: data.name,
      icon: data.icon ?? null,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      treePath,
      treeDepth,
      sortKey,
    })
    .returning();

  return { dependency };
}

export async function updateProductDependency(
  data: ProductDependencyUpdateInput,
): Promise<{ dependency: ProductDependencyRecord } | DependencyOperationError> {
  const existing = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.id, data.id))
    .limit(1);

  if (existing.length === 0) {
    return { error: "Dependência não encontrada", status: 404 };
  }

  const updateData: {
    name: string;
    icon: string | null;
    description: string | null;
    updatedAt: Date;
    parentId?: string | null;
    treePath?: string;
    sortKey?: string;
    treeDepth?: number;
  } = {
    name: data.name,
    icon: data.icon ?? null,
    description: data.description ?? null,
    updatedAt: new Date(),
  };

  if (data.newPosition !== undefined) {
    let parentData: ProductDependencyRecord | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select()
        .from(productDependency)
        .where(eq(productDependency.id, data.parentId))
        .limit(1);
      parentData = parent ?? null;
    }

    updateData.parentId = data.parentId ?? null;
    updateData.treePath = calculateTreePath(parentData?.treePath ?? null, data.newPosition);
    updateData.sortKey = calculateSortKey(parentData?.sortKey ?? null, data.newPosition);
    updateData.treeDepth = calculateTreeDepth(parentData?.treeDepth ?? null);
  }

  const [dependency] = await db
    .update(productDependency)
    .set(updateData)
    .where(eq(productDependency.id, data.id))
    .returning();

  if (!dependency) {
    return { error: "Dependência não encontrada", status: 404 };
  }

  return { dependency };
}

export async function deleteProductDependency(id: string): Promise<{ ok: true } | DependencyOperationError> {
  const existing = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.id, id))
    .limit(1);

  if (existing.length === 0) {
    return { error: "Dependência não encontrada", status: 404 };
  }

  const children = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.parentId, id));

  if (children.length > 0) {
    return {
      error: "Não é possível excluir uma dependência que possui itens filhos.",
      status: 400,
    };
  }

  await db.delete(productDependency).where(eq(productDependency.id, id));

  return { ok: true };
}

export async function reorderProductDependencies(
  productId: string,
  items: ProductDependencyReorderItem[],
): Promise<{ ok: true } | DependencyOperationError> {
  const existing = await db
    .select({ id: productDependency.id })
    .from(productDependency)
    .where(eq(productDependency.productId, productId));

  const existingIds = existing.map((item) => item.id);
  const invalidItems = items.filter((item) => !existingIds.includes(item.id));

  if (invalidItems.length > 0) {
    return {
      error: "Alguns itens não pertencem a este produto",
      status: 400,
    };
  }

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(productDependency)
        .set({
          parentId: item.parentId,
          treePath: item.treePath,
          treeDepth: item.treeDepth,
          sortKey: item.sortKey,
          updatedAt: new Date(),
        })
        .where(eq(productDependency.id, item.id));
    }
  });

  return { ok: true };
}
