import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { normalizeUploadsSrc } from "@/lib/utils";
import { successResponse, errorResponse } from "@/lib/api-response";

// Atualiza a URL da imagem de perfil do usuário (vinda do servidor local)
export async function POST(req: NextRequest) {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return errorResponse("URL da imagem não fornecida.", 400);
    }

    const normalizedUrl = normalizeUploadsSrc(imageUrl);

    // Atualiza a URL da imagem no banco de dados
    await db
      .update(authUser)
      .set({ image: normalizedUrl })
      .where(eq(authUser.id, user.id));

    console.log(
      "ℹ️ [API_USER_PROFILE_IMAGE_UPDATE] URL da imagem de perfil atualizada com sucesso:",
      { imageUrl: normalizedUrl },
    );

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
