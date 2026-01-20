import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { help } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

const HELP_ID = "system-help";

// GET - Buscar a documentação de ajuda
export async function GET() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    let helpDoc = await db
      .select()
      .from(help)
      .where(eq(help.id, HELP_ID))
      .limit(1);

    // Se não existe, criar um registro vazio
    if (helpDoc.length === 0) {
      await db.insert(help).values({
        id: HELP_ID,
        description: "",
      });

      helpDoc = await db
        .select()
        .from(help)
        .where(eq(help.id, HELP_ID))
        .limit(1);
    }

    return successResponse(helpDoc[0]);
  } catch (error) {
    console.error("❌ [API_HELP] Erro ao buscar documentação de ajuda:", {
      error,
    });
    return errorResponse("Erro ao carregar documentação", 500);
  }
}

// PUT - Atualizar a documentação de ajuda
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const body = await request.json();
    const { description } = body;

    // Garantir que o registro existe
    const existing = await db
      .select()
      .from(help)
      .where(eq(help.id, HELP_ID))
      .limit(1);

    if (existing.length === 0) {
      // Criar se não existe
      await db.insert(help).values({
        id: HELP_ID,
        description: description || "",
      });
    } else {
      // Atualizar se existe
      await db
        .update(help)
        .set({
          description: description || "",
          updatedAt: new Date(),
        })
        .where(eq(help.id, HELP_ID));
    }

    return successResponse(null, "Documentação atualizada com sucesso");
  } catch (error) {
    console.error("❌ [API_HELP] Erro ao atualizar documentação de ajuda:", {
      error,
    });
    return errorResponse("Erro ao salvar documentação", 500);
  }
}
