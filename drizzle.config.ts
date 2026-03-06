import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const isProd = process.env.NODE_ENV === "production";

// Permite sobrescrever a URL usada pelo drizzle-kit em execucoes locais/CI.
// Exemplo: DRIZZLE_DATABASE_URL=postgresql://... npm run db:migrate
const drizzleDatabaseUrl = process.env.DRIZZLE_DATABASE_URL;

// Em produção (Docker), usa DATABASE_URL_PROD.
// Em desenvolvimento, usa DATABASE_URL_DEV.
// Isso garante que o drizzle-kit use o mesmo banco que a aplicação.
const databaseUrl = isProd
  ? process.env.DATABASE_URL_PROD
  : process.env.DATABASE_URL_DEV;

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      drizzleDatabaseUrl ||
      databaseUrl ||
      process.env.DATABASE_URL_PROD ||
      process.env.DATABASE_URL_DEV!,
  },
  // Força o uso do schema public para gerenciar migrações, evitando tentativas de criar schemas extras
  migrations: {
    schema: "public",
    table: "__drizzle_migrations",
  },
});
