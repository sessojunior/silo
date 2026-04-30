import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { config } from "@/lib/config";
import { initializeApp, isProductionBuildPhase } from "@/lib/init";

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

if (config.nodeEnv === "production" && !isProductionBuildPhase()) {
  initializeApp();
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20, // Máximo 20 conexões simultâneas
  idleTimeoutMillis: 30000, // Fechar conexões idle após 30s
  connectionTimeoutMillis: 2000, // Timeout de 2s para obter conexão
  ssl:
    config.databaseUrl && shouldUseSsl(config.databaseUrl)
      ? { rejectUnauthorized: false }
      : undefined,
});

export const db = drizzle(pool, { schema });

const DATABASE_AVAILABILITY_TTL_MS = 5000;

let databaseAvailabilityCache:
  | {
      ok: boolean;
      checkedAt: number;
    }
  | undefined;
let databaseAvailabilityProbe: Promise<boolean> | null = null;

export async function isDatabaseAvailable(): Promise<boolean> {
  if (!config.databaseUrl) {
    databaseAvailabilityCache = { ok: false, checkedAt: Date.now() };
    return false;
  }

  const now = Date.now();
  if (
    databaseAvailabilityCache &&
    now - databaseAvailabilityCache.checkedAt < DATABASE_AVAILABILITY_TTL_MS
  ) {
    return databaseAvailabilityCache.ok;
  }

  if (databaseAvailabilityProbe) return databaseAvailabilityProbe;

  databaseAvailabilityProbe = pool
    .query("select 1")
    .then(() => {
      databaseAvailabilityCache = { ok: true, checkedAt: Date.now() };
      return true;
    })
    .catch((error: unknown) => {
      if (!isDatabaseInfrastructureUnavailable(error)) throw error;
      databaseAvailabilityCache = { ok: false, checkedAt: Date.now() };
      return false;
    })
    .finally(() => {
      databaseAvailabilityProbe = null;
    });

  return databaseAvailabilityProbe;
}
