import { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  errorResponse,
  parseRequestJson,
  successResponse,
} from "@/lib/api-response";
import { db } from "@/lib/db";
import { authUser, product } from "@/lib/db/schema";
import { buildProductActivityPendingEmailSubject } from "@/lib/product-activity-pending-email";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";

const TurnSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    return Number(trimmed);
  }
  return value;
}, z.number().int().min(0).max(23));

const PendingEmailSchema = z.object({
  productId: z.string().trim().min(1, "Produto é obrigatório."),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  turn: TurnSchema,
  status: z.string().trim().min(1, "Status é obrigatório."),
  incidentName: z.string().trim().max(120).nullish(),
  recipientUserIds: z
    .array(z.string().trim().min(1, "Destinatário inválido."))
    .min(1, "Selecione pelo menos um destinatário.")
    .max(50, "Selecione no máximo 50 destinatários."),
  message: z
    .string()
    .trim()
    .min(1, "Mensagem é obrigatória.")
    .max(20000, "Mensagem deve ter no máximo 20000 caracteres."),
});

export async function GET() {
  try {
    const authResult = await requirePermissionAuthUser(
      "productActivities",
      "update",
    );
    if (!authResult.ok) return authResult.response;

    const users = await db
      .select({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        image: authUser.image,
      })
      .from(authUser)
      .where(eq(authUser.isActive, true))
      .orderBy(asc(authUser.name));

    return successResponse({ items: users, total: users.length });
  } catch (error) {
    console.error("❌ [API_PENDING_EMAIL] Erro ao carregar usuários:", {
      error,
    });
    return errorResponse("Erro ao carregar destinatários.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser(
      "productActivities",
      "update",
    );
    if (!authResult.ok) return authResult.response;

    const parsedBody = await parseRequestJson(req, PendingEmailSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const data = parsedBody.data;
    const recipientUserIds = Array.from(new Set(data.recipientUserIds));

    const [productRecord] = await db
      .select({ id: product.id, name: product.name })
      .from(product)
      .where(eq(product.id, data.productId))
      .limit(1);

    if (!productRecord) {
      return errorResponse("Produto não encontrado.", 404);
    }

    const recipients = await db
      .select({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
      })
      .from(authUser)
      .where(
        and(
          inArray(authUser.id, recipientUserIds),
          eq(authUser.isActive, true),
        ),
      );

    if (recipients.length !== recipientUserIds.length) {
      return errorResponse(
        "Um ou mais destinatários não foram encontrados ou estão inativos.",
        400,
      );
    }

    const subject = buildProductActivityPendingEmailSubject({
      productName: productRecord.name,
      date: data.date,
      turn: data.turn,
      status: data.status,
      incidentName: data.incidentName,
    });

    const results = await Promise.all(
      recipients.map(async (recipient) => {
        const result = await sendEmail({
          to: recipient.email,
          subject,
          text: data.message,
        });

        return {
          recipient,
          result,
        };
      }),
    );

    const failures = results.filter(({ result }) => "error" in result);
    if (failures.length > 0) {
      console.error("❌ [API_PENDING_EMAIL] Falha ao enviar pendências:", {
        failures: failures.map(({ recipient, result }) => ({
          email: recipient.email,
          error: "error" in result ? result.error : null,
        })),
      });

      return errorResponse("Erro ao enviar e-mail para destinatário(s).", 502, {
        sent: recipients.length - failures.length,
        failed: failures.length,
      });
    }

    return successResponse(
      { sent: recipients.length },
      recipients.length === 1
        ? "Pendência enviada com sucesso."
        : "Pendências enviadas com sucesso.",
    );
  } catch (error) {
    console.error("❌ [API_PENDING_EMAIL] Erro ao enviar pendências:", {
      error,
    });
    return errorResponse("Erro ao enviar pendências.", 500);
  }
}