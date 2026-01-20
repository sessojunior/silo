import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { productActivity, productProblem } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET - Verificar se incidente está em uso
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const incidentId = searchParams.get("incidentId");

    if (!incidentId) {
      return errorResponse("ID do incidente é obrigatório.", 400);
    }

    // Verificar uso em atividades
    const usageInActivities = await db
      .select()
      .from(productActivity)
      .where(eq(productActivity.problemCategoryId, incidentId));

    // Verificar uso em problemas
    const usageInProblems = await db
      .select()
      .from(productProblem)
      .where(eq(productProblem.problemCategoryId, incidentId));

    const totalUsage = usageInActivities.length + usageInProblems.length;

    return successResponse({
      inUse: totalUsage > 0,
      usageCount: totalUsage,
      usageDetails: {
        activities: usageInActivities.length,
        problems: usageInProblems.length,
      },
    });
  } catch (error) {
    console.error(
      "❌ [API_INCIDENTS_USAGE] Erro ao verificar uso do incidente:",
      { error },
    );
    return errorResponse("Erro interno ao verificar uso do incidente", 500);
  }
}
