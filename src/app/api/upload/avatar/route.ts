import { NextRequest } from "next/server";
import { storeImageAsWebp } from "@/lib/localUploads";
import { successResponse, errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

type SingleUploadData = {
  key: string;
  name: string;
  size: number;
  url: string;
  id: string;
  status: "uploaded";
  optimized: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    const file = candidate instanceof File ? candidate : null;

    if (!file) {
      return errorResponse("Nenhum arquivo enviado", 400);
    }

    const stored = await storeImageAsWebp({
      file,
      kind: "avatars",
      requestUrl: request.url,
      options: { mode: "square", size: 80, quality: 85 },
    });

    if ("error" in stored) {
      return errorResponse(stored.error, 400);
    }

    const data: SingleUploadData = {
      key: stored.filename,
      name: stored.originalName,
      size: stored.size,
      url: stored.url,
      id: stored.filename,
      status: "uploaded",
      optimized: true,
    };

    return successResponse(data, "Upload de avatar concluído com sucesso!");
  } catch (error) {
    console.error("❌ [API_UPLOAD_AVATAR] Erro no proxy de upload de avatar:", {
      error,
    });
    return errorResponse("Erro interno do servidor", 500);
  }
}
