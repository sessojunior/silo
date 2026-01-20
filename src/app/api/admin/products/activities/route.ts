import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { productActivity } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/dateUtils";
import { recordProductActivityHistory } from "@/lib/productActivityHistory";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const data = await req.json();
    const { productId, date, turn, status, description, problemCategoryId } =
      data || {};

    // Normalizar data para timezone de São Paulo
    const normalizedDate = formatDate(date);

    if (!productId || !normalizedDate || turn === undefined || !status) {
      return errorResponse("Parâmetros obrigatórios ausentes.", 400);
    }

    // Usar UPSERT para evitar race condition
    // Com constraint UNIQUE em (productId, date, turn), podemos usar ON CONFLICT
    const [record] = await db
      .insert(productActivity)
      .values({
        id: randomUUID(),
        productId,
        userId: user.id,
        date: normalizedDate,
        turn,
        status,
        description: description || null,
        problemCategoryId: problemCategoryId || null,
      })
      .onConflictDoUpdate({
        target: [
          productActivity.productId,
          productActivity.date,
          productActivity.turn,
        ],
        set: {
          status,
          description: description || null,
          problemCategoryId: problemCategoryId || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const action: "created" | "updated" =
      record.createdAt.getTime() === record.updatedAt.getTime()
        ? "created"
        : "updated";

    // Registrar histórico
    await recordProductActivityHistory({
      productActivityId: record.id,
      userId: user.id,
      status: record.status,
      description: record.description,
    });

    return successResponse(
      record,
      action === "created"
        ? "Atividade criada com sucesso"
        : "Atividade atualizada com sucesso",
      200,
      { action },
    );
  } catch (error) {
    console.error("Erro ao criar/atualizar atividade do produto:", error);
    return errorResponse("Erro interno ao salvar atividade", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const data = await req.json();
    const { id, status, description, problemCategoryId } = data || {};

    if (!id || !status) {
      return errorResponse("Parâmetros obrigatórios ausentes.", 400);
    }

    // Verificar se o registro existe antes de atualizar
    await db.query.productActivity.findFirst({
      where: eq(productActivity.id, id),
    });

    const [updated] = await db
      .update(productActivity)
      .set({
        status,
        description: description || null,
        problemCategoryId: problemCategoryId || null,
        updatedAt: new Date(),
      })
      .where(eq(productActivity.id, id))
      .returning();

    // Registrar histórico
    await recordProductActivityHistory({
      productActivityId: updated.id,
      userId: user.id,
      status: updated.status,
      description: updated.description,
    });

    return successResponse(updated, "Atividade atualizada com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar atividade do produto:", error);
    return errorResponse("Erro interno", 500);
  }
}
