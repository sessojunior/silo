import { db } from "@silo/database";
import { authUser, product, productActivity, productActivityHistory } from "@silo/database/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { formatDate, formatDateBR } from "@silo/engine/date";
import { recordProductActivityHistory } from "../domain/product-activity-history.js";
import { sendEmail } from "../infra/send-email.js";

type ProductActivityServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductActivityServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
};

const success = <T>(data: T): ProductActivityServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductActivityServiceError, "ok" | "error" | "status">,
): ProductActivityServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

type ProductActivityHistoryRecord = typeof productActivityHistory.$inferSelect;
type ProductActivityRecord = typeof productActivity.$inferSelect;

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
}): Promise<ProductActivityServiceSuccess<{ history: ProductActivityHistoryItem[] }> | ProductActivityServiceError> {
  const date = typeof params.date === "string" ? params.date.trim() : params.date ? formatDate(params.date) : "";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return failure("Data inválida.", 400);
  }

  const turn = typeof params.turn === "string" ? Number(params.turn) : params.turn;
  if (turn === null || turn === undefined || !Number.isFinite(turn)) {
    return failure("Turno inválido.", 400);
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
    return success({ history: [] });
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

  return success({ history });
}

type ProductActivityPendingEmailRecipient = Pick<
  typeof authUser.$inferSelect,
  "id" | "name" | "email" | "image"
>;

export async function listProductActivityPendingEmailRecipients(): Promise<ProductActivityServiceSuccess<{
  items: ProductActivityPendingEmailRecipient[];
  total: number;
}>> {
  const items = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image })
    .from(authUser)
    .where(eq(authUser.isActive, true))
    .orderBy(asc(authUser.name));

  return success({ items, total: items.length });
}

export async function sendProductActivityPendingEmail(data: {
  productId: string;
  date: string;
  turn: number;
  status: string;
  incidentName?: string | null;
  recipientUserIds: string[];
  message: string;
}): Promise<ProductActivityServiceSuccess<{ sent: number }> | ProductActivityServiceError> {
  const [productRecord] = await db
    .select({ id: product.id, name: product.name })
    .from(product)
    .where(eq(product.id, data.productId))
    .limit(1);

  if (!productRecord) {
    return failure("Produto não encontrado.", 404);
  }

  const recipientUserIds = Array.from(new Set(data.recipientUserIds));
  const recipients = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email })
    .from(authUser)
    .where(and(inArray(authUser.id, recipientUserIds), eq(authUser.isActive, true)));

  if (recipients.length !== recipientUserIds.length) {
    return failure("Um ou mais destinatários não encontrados ou inativos.", 400);
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
    return failure("Erro ao enviar e-mail para destinatário(s).", 502, {
      data: { sent: recipients.length - failures.length, failed: failures.length },
    });
  }

  return success({ sent: recipients.length });
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
  ProductActivityServiceSuccess<{ activity: ProductActivityRecord; action: "created" | "updated" }> | ProductActivityServiceError
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
    return failure("Erro ao salvar atividade.", 500);
  }

  const action = record.createdAt.getTime() === record.updatedAt.getTime() ? "created" : "updated";
  await recordProductActivityHistory({
    productActivityId: record.id,
    userId: params.userId,
    status: record.status,
    description: record.description,
    intervention: record.intervention,
  });

  return success({ activity: record, action });
}

export async function updateProductActivity(params: {
  userId: string;
  id: string;
  status: string;
  description?: string | null;
  intervention?: string | null;
  problemCategoryId?: string | null;
}): Promise<ProductActivityServiceSuccess<{ activity: ProductActivityRecord }> | ProductActivityServiceError> {
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
    return failure("Atividade não encontrada.", 404);
  }

  await recordProductActivityHistory({
    productActivityId: updated.id,
    userId: params.userId,
    status: updated.status,
    description: updated.description,
    intervention: updated.intervention,
  });

  return success({ activity: updated });
}