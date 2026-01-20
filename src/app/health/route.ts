import { successResponse } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  return successResponse(
    {
      timestamp: new Date().toISOString(),
    },
    "Aplicação funcionando",
  );
}
