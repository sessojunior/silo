import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { productSolutionImage } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { requestUtils } from "@/lib/config";
import {
  deleteUploadFile,
  isSafeFilename,
  isUploadKind,
} from "@/lib/localUploads";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authResult = await requireAdminAuthUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const solutionId = searchParams.get("solutionId");

  if (!solutionId) {
    return errorResponse("Parâmetro solutionId é obrigatório.", 400);
  }

  try {
    const images = await db
      .select()
      .from(productSolutionImage)
      .where(eq(productSolutionImage.productSolutionId, solutionId));
    return successResponse({ items: images });
  } catch {
    return errorResponse("Erro ao buscar imagens.", 500);
  }
}

// Upload de imagem de solução
export async function POST(req: NextRequest) {
  const authResult = await requireAdminAuthUser();
  if (!authResult.ok) return authResult.response;

  try {
    const formData = await req.formData();
    const productSolutionId = formData.get("productSolutionId") as
      | string
      | null;
    const description = (formData.get("description") as string | null) || "";
    const imageUrl = formData.get("imageUrl") as string | null;

    if (!imageUrl || !productSolutionId) {
      return errorResponse(
        "Arquivo e productSolutionId são obrigatórios.",
        400,
      );
    }

    if (imageUrl) {
      const id = randomUUID();
      await db.insert(productSolutionImage).values({
        id,
        productSolutionId,
        image: imageUrl,
        description,
      });
      return successResponse(
        { image: imageUrl },
        "Imagem enviada com sucesso",
        201,
      );
    }

    // Upload de arquivo local não é mais suportado
    return errorResponse("URL de imagem é obrigatória.", 400);
  } catch {
    return errorResponse("Erro ao fazer upload da imagem.", 500);
  }
}

// Exclusão individual de imagem de solução
export async function DELETE(req: NextRequest) {
  const authResult = await requireAdminAuthUser();
  if (!authResult.ok) return authResult.response;

  try {
    const { id } = await req.json();
    if (!id) {
      return errorResponse("ID da imagem é obrigatório.", 400);
    }
    const img = await db
      .select()
      .from(productSolutionImage)
      .where(eq(productSolutionImage.id, id));
    if (!img.length) {
      return errorResponse("Imagem não encontrada.", 404);
    }

    // Remover arquivo do disco também
    try {
      const imageUrl = img[0].image;
      if (requestUtils.isFileServerUrl(imageUrl)) {
        const filePath = requestUtils.extractFilePath(imageUrl);
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
    } catch (error) {
      console.warn(
        "⚠️ [API_PRODUCTS_SOLUTIONS_IMAGES] Erro ao remover arquivo do disco:",
        { error },
      );
    }

    // Remove do banco
    await db
      .delete(productSolutionImage)
      .where(eq(productSolutionImage.id, id));

    return successResponse(null, "Imagem excluída com sucesso");
  } catch (error) {
    console.error(
      "❌ [API_PRODUCTS_SOLUTIONS_IMAGES] Erro ao excluir imagem:",
      { error },
    );
    return errorResponse("Erro ao excluir imagem.", 500);
  }
}
