import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  productProblemCategory,
  productActivity,
  productProblem,
} from "@/lib/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NO_INCIDENTS_CATEGORY_ID } from "@/lib/constants";

// GET - Listar incidentes (excluindo "Não houve incidentes")
export async function GET() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const incidents = await db
      .select()
      .from(productProblemCategory)
      .where(ne(productProblemCategory.id, NO_INCIDENTS_CATEGORY_ID)) // ← FILTRO AUTOMÁTICO
      .orderBy(productProblemCategory.sortOrder, productProblemCategory.name);

    return successResponse(incidents);
  } catch (error) {
    console.error("Erro ao listar incidentes:", error);
    return errorResponse("Erro interno ao listar incidentes", 500);
  }
}

// POST - Criar novo incidente
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { name, color } = await request.json();

    if (!name || name.trim().length < 2) {
      return errorResponse(
        "Nome do incidente é obrigatório e deve ter pelo menos 2 caracteres.",
        400,
      );
    }

    // Validação: nome único
    const existing = await db
      .select()
      .from(productProblemCategory)
      .where(eq(productProblemCategory.name, name.trim()))
      .limit(1);

    if (existing.length > 0) {
      return errorResponse("Nome de incidente já existe.", 400);
    }

    // Criar incidente
    const newIncident = {
      id: randomUUID(),
      name: name.trim(),
      color: color || "#6B7280",
      isSystem: false,
      sortOrder: 999, // Último na lista
    };

    await db.insert(productProblemCategory).values(newIncident);
    return successResponse(newIncident);
  } catch (error) {
    console.error("❌ [API_INCIDENTS] Erro ao criar incidente:", { error });
    return errorResponse("Erro interno ao criar incidente", 500);
  }
}

// PUT - Atualizar incidente existente
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { id, name, color } = await request.json();

    if (!id || !name || name.trim().length < 2) {
      return errorResponse("ID e nome do incidente são obrigatórios.", 400);
    }

    // Não permitir edição de "Não houve incidentes"
    if (id === NO_INCIDENTS_CATEGORY_ID) {
      return errorResponse("Não é possível editar esta categoria.", 400);
    }

    // Validação: nome único (exceto o próprio)
    const existing = await db
      .select()
      .from(productProblemCategory)
      .where(
        and(
          eq(productProblemCategory.name, name.trim()),
          ne(productProblemCategory.id, id),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return errorResponse("Nome de incidente já existe.", 400);
    }

    // Atualizar incidente
    await db
      .update(productProblemCategory)
      .set({
        name: name.trim(),
        color: color || "#6B7280",
        updatedAt: new Date(),
      })
      .where(eq(productProblemCategory.id, id));

    return successResponse(null, "Incidente atualizado com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar incidente:", error);
    return errorResponse("Erro interno ao atualizar incidente", 500);
  }
}

// DELETE - Excluir incidente (com validação de uso)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse("ID do incidente é obrigatório.", 400);
    }

    // Verificar se é uma categoria do sistema
    const category = await db
      .select({
        isSystem: productProblemCategory.isSystem,
        name: productProblemCategory.name,
      })
      .from(productProblemCategory)
      .where(eq(productProblemCategory.id, id))
      .limit(1);

    if (category.length === 0) {
      return errorResponse("Incidente não encontrado.", 404);
    }

    if (category[0].isSystem) {
      return errorResponse(
        `"${category[0].name}" é uma categoria do sistema e não pode ser excluída.`,
        400,
      );
    }

    // Verificar se está em uso (consulta direta)
    const usageInActivities = await db
      .select()
      .from(productActivity)
      .where(eq(productActivity.problemCategoryId, id));

    const usageInProblems = await db
      .select()
      .from(productProblem)
      .where(eq(productProblem.problemCategoryId, id));

    const totalUsage = usageInActivities.length + usageInProblems.length;

    if (totalUsage > 0) {
      const message =
        totalUsage === 1
          ? "Este incidente está sendo usado em 1 registro e não pode ser excluído."
          : `Este incidente está sendo usado em ${totalUsage} registros e não pode ser excluído.`;

      return errorResponse(message, 400);
    }

    // Excluir incidente
    await db
      .delete(productProblemCategory)
      .where(eq(productProblemCategory.id, id));

    return successResponse({ success: true });
  } catch (error) {
    console.error("❌ [API_INCIDENTS] Erro ao excluir incidente:", { error });

    // Verificar se é erro de constraint (chave estrangeira)
    if (error instanceof Error && error.message.includes("foreign key")) {
      return errorResponse(
        "Este incidente está sendo usado em outros registros e não pode ser excluído.",
        400,
      );
    }

    return errorResponse(
      "Erro interno ao excluir incidente. Tente novamente.",
      500,
    );
  }
}
