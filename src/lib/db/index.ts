import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";
import { config } from "@/lib/config";
import { initializeApp, isProductionBuildPhase } from "@/lib/init";

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
