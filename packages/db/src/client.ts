import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const DATABASE_INFRASTRUCTURE_ERROR_CODES = new Set([
  "3D000",
  "42P01",
  "57P01",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
]);

const collectErrorCodes = (
  error: unknown,
  visited = new Set<unknown>(),
): string[] => {
  if (!error || typeof error !== "object" || visited.has(error)) return [];
  visited.add(error);

  const current = error as {
    code?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  const codes =
    typeof current.code === "string" && current.code.length > 0
      ? [current.code]
      : [];

  const nestedErrors = Array.isArray(current.errors)
    ? current.errors.flatMap((item) => collectErrorCodes(item, visited))
    : [];
  const nestedCause = collectErrorCodes(current.cause, visited);

  return [...codes, ...nestedErrors, ...nestedCause];
};

export const isDatabaseInfrastructureUnavailable = (error: unknown): boolean => {
  const codes = collectErrorCodes(error);
  if (codes.some((code) => DATABASE_INFRASTRUCTURE_ERROR_CODES.has(code))) {
    return true;
  }

  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("connect econnrefused") ||
    message.includes("failed query") ||
    message.includes('relation "rate_limit" does not exist')
  );
};

const shouldUseSsl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (lower.includes("sslmode=require")) return true;
  if (lower.includes("neon.tech")) return true;
  return false;
};

export const createDb = (connectionString: string) => {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: connectionString && shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // Neon (e outros hosts gerenciados) encerra conexões idle sem aviso, o que
  // gera ECONNABORTED/ECONNRESET no pool. Sem este handler o Node morre com
  // "Unhandled 'error' event". Aqui apenas descartamos erros de rede
  // esperados — o pool já remove automaticamente o cliente problemático.
  pool.on("error", (err) => {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    if (["ECONNABORTED", "ECONNRESET", "EPIPE", "ETIMEDOUT"].includes(code)) {
      return;
    }
    console.error("❌ [DB_POOL] Erro inesperado no pool de conexões:", err);
  });

  return drizzle(pool, { schema });
};

const resolveDefaultConnectionString = (): string => {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  return (
    (isProduction
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV) ||
    (isProduction
      ? process.env.DATABASE_URL_DEV
      : process.env.DATABASE_URL_PROD) ||
    ""
  );
};

export const db = createDb(resolveDefaultConnectionString());
