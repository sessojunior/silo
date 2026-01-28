import { successResponse, errorResponse } from "@/lib/api-response";
import { db } from "@/lib/db";
import { product, productActivity } from "@/lib/db/schema";
import { eq, gte } from "drizzle-orm";
import { formatDate, getMonthsAgo, getDaysAgo } from "@/lib/dateUtils";
import { INCIDENT_STATUS } from "@/lib/productStatus";
import { requireAdminAuthUser } from "@/lib/auth/server";

export const runtime = "nodejs";

type AlertStatus =
  | "pending"
  | "not_run"
  | "with_problems"
  | "run_again"
  | "under_support"
  | "suspended";

type DashboardProduct = {
  productId: string;
  name: string;
  priority: string;
  last_run: string | null;
  percent_completed: number;
  dates: {
    id: string;
    date: string;
    turn: number;
    user_id: string;
    status: string;
    description: string | null;
    category_id: string | null;
    alert: boolean;
  }[];
  turns: string[];
};

const defaultTurns: ReadonlyArray<string> = ["0", "6", "12", "18"];

const normalizeTurns = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number") return String(item);
        return null;
      })
      .filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );

    return normalized.length > 0 ? normalized : [...defaultTurns];
  }

  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];

  return [...defaultTurns];
};

function isAlert(status: string): status is AlertStatus {
  return INCIDENT_STATUS.has(status as AlertStatus);
}

// Deve retornar um array de produtos com as seguintes informações:
// {
//   productId: string,          // id do produto
//   name: string,               // nome do produto
//   priority: string,           // 'low' | 'normal' | 'high' | 'urgent'
//   last_run: string | null,    // 'YYYY-MM-DD HH:mm:ss'
//   percent_completed: number,  // 0-100 (últimos 28 dias)
//   dates: Array<{
//     date: string,             // 'YYYY-MM-DD' (3 últimos meses, do dia 1º do mês menos 2 até hoje)
//     turn: number,             // 0 | 6 | 12 | 18
//     user_id: string,          // id do usuário responsável
//     status: string,           // 'completed', 'pending', 'in_progress', 'not_run', 'with_problems', 'run_again', 'under_support', 'suspended', 'off'
//     description: string|null, // descrição da atividade
//     alert: boolean            // true ↔ status ∈ {'pending', 'not_run', 'with_problems', 'run_again', 'under_support', 'suspended'}
//   }>
// }
export async function GET() {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    // Buscar produtos ativos
    const products = await db
      .select()
      .from(product)
      .where(eq(product.available, true));
    if (products.length === 0) return successResponse([]);

    // Data cutoff: 3 últimos meses (do dia 1º do mês menos 2 até hoje) - timezone São Paulo
    const cutoff = getMonthsAgo(2); // primeiro dia do mês há 2 meses

    const activityRows = await db
      .select()
      .from(productActivity)
      .where(gte(productActivity.date, cutoff))
      .orderBy(productActivity.date, productActivity.turn);

    const grouped = new Map<string, DashboardProduct>();

    for (const p of products) {
      grouped.set(p.id, {
        productId: p.id,
        name: p.name,
        priority: p.priority,
        turns: normalizeTurns(p.turns),
        last_run: null,
        percent_completed: 0,
        dates: [],
      });
    }

    // Preprocess rows
    for (const row of activityRows) {
      const g = grouped.get(row.productId);
      if (!g) continue;

      const dateStr = formatDate(row.date);

      g.dates.push({
        id: row.id,
        date: dateStr,
        turn: row.turn,
        user_id: row.userId,
        status: row.status,
        description: row.description,
        category_id: row.problemCategoryId ?? null,
        alert: isAlert(row.status),
      });

      // last_run usando updatedAt real da atividade (formato YYYY-MM-DD HH:mm:ss em São Paulo)
      const updatedAtStr = row.updatedAt
        .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
        .replace("T", " ");
      if (!g.last_run || updatedAtStr > g.last_run) {
        g.last_run = updatedAtStr;
      }
    }

    // Calcula percent_completed (últimos 28 dias) - timezone São Paulo
    const cut28 = getDaysAgo(28);

    for (const g of grouped.values()) {
      const last28 = g.dates.filter((d) => d.date >= cut28);
      const completed = last28.filter((d) => d.status === "completed").length;
      g.percent_completed = last28.length
        ? Math.round((completed / last28.length) * 100)
        : 0;
    }

    return successResponse(Array.from(grouped.values()));
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
    console.error("❌ [API_DASHBOARD] Erro ao obter dados dos produtos:", {
      ...errorInfo,
    });
    return errorResponse("Erro ao obter dados dos produtos", 500);
  }
}
