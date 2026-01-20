import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { getNowTimestamp } from "@/lib/dateUtils";

/**
 * API endpoint para receber notificações sobre mudanças no status do chat
 * Permite que o servidor registre e controle quando o chat é ativado/desativado
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    // Obter dados da requisição
    const body = await req.json();
    const { status } = body;

    // Validar status
    if (!status || !["enabled", "disabled"].includes(status)) {
      return errorResponse(
        'Status inválido. Deve ser "enabled" ou "disabled"',
        400,
      );
    }

    // Log no servidor sobre mudança de status - timezone São Paulo
    const timestamp = getNowTimestamp();
    // const statusText = status === 'enabled' ? 'ATIVADO' : 'DESATIVADO'

    // Aqui você pode adicionar lógica adicional para:
    // - Registrar em log de sistema
    // - Atualizar métricas
    // - Notificar outros serviços
    // - Parar/iniciar processos de background

    return successResponse(
      {
        success: true,
        message: `Status do chat atualizado para: ${status}`,
        userId: user.id,
        userEmail: user.email,
        status,
        timestamp,
      },
      `Status do chat atualizado para: ${status}`,
    );
  } catch (error) {
    console.error(
      "❌ [API_CHAT_STATUS] Erro ao processar mudança de status do chat:",
      { error },
    );

    return errorResponse("Erro interno do servidor", 500);
  }
}
