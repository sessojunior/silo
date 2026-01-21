import { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { normalizeUploadsSrc } from "@/lib/utils";
import { parseRequestJson, successResponse, errorResponse } from "@/lib/api-response";
import { z } from "zod";

const UpdateUserProfileImageSchema = z.object({
  imageUrl: z.string().trim().min(1, "URL da imagem não fornecida."),
});

// Atualiza a URL da imagem de perfil do usuário (vinda do servidor local)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const parsedBody = await parseRequestJson(req, UpdateUserProfileImageSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { imageUrl } = parsedBody.data;

    const normalizedUrl = normalizeUploadsSrc(imageUrl);

    // Atualiza a URL da imagem no banco de dados
    await db
      .update(authUser)
      .set({ image: normalizedUrl })
      .where(eq(authUser.id, user.id));

    // Retorna a resposta com sucesso
    return successResponse(
      { imageUrl: normalizedUrl },
      "URL da imagem atualizada com sucesso!",
    );
  } catch (error) {
    console.error(
      "❌ [API_USER_PROFILE_IMAGE_UPDATE] Erro ao atualizar URL da imagem de perfil:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
