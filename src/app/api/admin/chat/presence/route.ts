import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

// Tipos para presença
interface PresenceStatus {
  userId: string;
  userName: string;
  status: "visible" | "invisible";
  lastActivity: Date;
  updatedAt: Date;
}

interface UpdatePresenceRequest {
  status: "visible" | "invisible";
}

// GET: Buscar status de presença de todos os chatUsers
export async function GET() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    // Buscar presença de todos usuários (incluindo atual para verificações)
    const presenceData = await db
      .select({
        userId: schema.chatUserPresence.userId,
        userName: schema.authUser.name,
        status: schema.chatUserPresence.status,
        lastActivity: schema.chatUserPresence.lastActivity,
        updatedAt: schema.chatUserPresence.updatedAt,
      })
      .from(schema.chatUserPresence)
      .innerJoin(
        schema.authUser,
        eq(schema.chatUserPresence.userId, schema.authUser.id),
      );

    // Atualizar status automático baseado em inatividade
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutos
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutos

    const updatedPresence: PresenceStatus[] = presenceData.map((p) => {
      let autoStatus = p.status;

      // Auto-atualização de status baseado em inatividade (apenas se visible)
      if (p.status === "visible") {
        if (p.lastActivity < thirtyMinutesAgo) {
          autoStatus = "invisible";
        } else if (p.lastActivity < fiveMinutesAgo) {
          autoStatus = "invisible";
        }
      }
      // Status manuais (invisible) são preservados

      return {
        userId: p.userId,
        userName: p.userName,
        status: autoStatus as PresenceStatus["status"],
        lastActivity: p.lastActivity,
        updatedAt: p.updatedAt,
      };
    });

    // Separar usuário atual dos outros para retorno
    const currentUserPresence = updatedPresence.find(
      (p) => p.userId === user.id,
    );
    const otherUsersPresence = updatedPresence.filter(
      (p) => p.userId !== user.id,
    );

    return successResponse({
      presence: otherUsersPresence, // Para compatibilidade (sidebar usa apenas outros usuários)
      currentUserPresence, // Para verificação de status atual
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("❌ [API_CHAT_PRESENCE] Erro ao buscar status de presença:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST: Atualizar status de presença do chatUser atual
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const body: UpdatePresenceRequest = await request.json();
    const { status } = body;

    // Validar status
    const validStatuses = ["visible", "invisible"];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse("Status inválido. Use: visible ou invisible", 400);
    }

    const now = new Date();

    await db
      .insert(schema.chatUserPresence)
      .values({
        userId: user.id,
        status,
        lastActivity: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.chatUserPresence.userId,
        set: {
          status,
          lastActivity: now,
          updatedAt: now,
        },
      });

    return successResponse({ success: true }, "Status atualizado com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar presença:", error);
    return errorResponse("Erro ao atualizar presença.", 500);
  }
}

// PATCH: Atualizar apenas atividade (heartbeat)
export async function PATCH() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = authResult.user;

    const now = new Date();

    await db
      .insert(schema.chatUserPresence)
      .values({
        userId: user.id,
        status: "visible",
        lastActivity: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.chatUserPresence.userId,
        set: {
          lastActivity: now,
          updatedAt: now,
        },
      });

    return successResponse({
      success: true,
      lastActivity: now,
    });
  } catch (error) {
    console.error("❌ [API_CHAT_PRESENCE] Erro no heartbeat de atividade:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
