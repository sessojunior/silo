import { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/auth/server";
import { deleteUserProfileImage } from "@/lib/profileImage";
import { db } from "@/lib/db";
import { authUser } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requestUtils } from "@/lib/config";
import {
  deleteUploadFile,
  isSafeFilename,
  isUploadKind,
  storeImageAsWebp,
} from "@/lib/localUploads";
import { successResponse, errorResponse } from "@/lib/api-response";

// Faz o upload da imagem de perfil do usuário
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const currentUser = await db
      .select({ image: authUser.image })
      .from(authUser)
      .where(eq(authUser.id, user.id))
      .limit(1);
    const currentImageUrl = currentUser[0]?.image ?? null;

    if (currentImageUrl && requestUtils.isFileServerUrl(currentImageUrl)) {
      const filePath = requestUtils.extractFilePath(currentImageUrl);
      if (filePath) {
        const [kind, ...rest] = filePath.split("/");
        const filename = rest.join("/");
        if (
          kind &&
          filename &&
          isUploadKind(kind) &&
          isSafeFilename(filename)
        ) {
          await deleteUploadFile(kind, filename);
        }
      }
    }

    // Obtem a imagem de perfil do usuário
    const formData = await req.formData();
    const file = formData.get("fileToUpload") as File;

    // Verifica se o arquivo de imagem foi enviado
    if (!file || !(file instanceof File)) {
      return errorResponse("O arquivo da imagem não foi enviado.", 400);
    }

    const stored = await storeImageAsWebp({
      file,
      kind: "avatars",
      requestUrl: req.url,
      options: { mode: "square", size: 128, quality: 85 },
    });

    if ("error" in stored) {
      return errorResponse(stored.error, 400);
    }

    await db
      .update(authUser)
      .set({ image: stored.url })
      .where(eq(authUser.id, user.id));

    // Retorna a resposta com sucesso
    return successResponse(
      { imageUrl: stored.url },
      "Imagem alterada com sucesso!",
    );
  } catch (error) {
    console.error(
      "❌ [API_USER_PROFILE_IMAGE] Erro ao alterar a imagem de perfil do usuário:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}

// Apaga a imagem de perfil do usuário
export async function DELETE() {
  try {
    const authResult = await requireAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    // Busca a imagem atual do usuário
    const currentUser = await db
      .select({ image: authUser.image })
      .from(authUser)
      .where(eq(authUser.id, user.id))
      .limit(1);

    if (currentUser[0]?.image) {
      const imageUrl = currentUser[0].image;

      // Verificar se é URL do servidor local
      if (requestUtils.isFileServerUrl(imageUrl)) {
        const filePath = requestUtils.extractFilePath(imageUrl);
        if (filePath) {
          try {
            const [kind, ...rest] = filePath.split("/");
            const filename = rest.join("/");
            if (
              kind &&
              filename &&
              isUploadKind(kind) &&
              isSafeFilename(filename)
            ) {
              const deleted = await deleteUploadFile(kind, filename);
              if (!deleted) {
                console.warn(
                  "⚠️ [API_USER_PROFILE_IMAGE] Erro ao deletar arquivo do servidor local",
                );
              }
            }
          } catch (error) {
            console.error(
              "❌ [API_USER_PROFILE_IMAGE] Erro ao excluir imagem de perfil do servidor local:",
              { error },
            );
          }
        }
      } else {
        // Se é imagem local (antiga), usa método antigo
        const deleteImage = deleteUserProfileImage(user.id);
        if ("error" in deleteImage) {
          console.error(
            "❌ [API_USER_PROFILE_IMAGE] Erro ao apagar a imagem de perfil local:",
            { error: deleteImage.error },
          );
          return errorResponse(deleteImage.error.message, 400);
        }
      }
    }

    // Limpa a referência no banco
    await db
      .update(authUser)
      .set({ image: null })
      .where(eq(authUser.id, user.id));

    // Retorna a resposta com sucesso
    return successResponse(null, "Imagem apagada com sucesso!");
  } catch (error) {
    console.error(
      "❌ [API_USER_PROFILE_IMAGE] Erro ao apagar a imagem de perfil do usuário:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
