import { successResponse } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  return successResponse(
    {
      time: new Date().toISOString(),
    },
    "Hora do servidor",
  );
}
