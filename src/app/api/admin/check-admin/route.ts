import { requireAuthUser } from "@/lib/auth/server";
import { isUserAdmin } from "@/lib/auth/admin";
import { errorResponse, successResponse } from "@/lib/api-response";

// GET - Verificar se o usuário atual é administrador
export async function GET() {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) {
      return errorResponse("Usuário não autenticado", 401, { isAdmin: false });
    }

    // Verificar se o usuário é administrador
    const isAdmin = await isUserAdmin(authResult.user.id);

    return successResponse({ isAdmin });
  } catch (error) {
    console.error(
      "❌ [API_CHECK_ADMIN] Erro ao verificar status de administrador:",
      { error },
    );
    return errorResponse("Erro interno do servidor", 500, { isAdmin: false });
  }
}
