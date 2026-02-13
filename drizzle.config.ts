import { defineConfig } from "drizzle-kit";

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv/config");
} catch {
  // Ignora erro silenciosamente
}

const isProd = process.env.NODE_ENV === "production";

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
    url: databaseUrl || process.env.DATABASE_URL_PROD || process.env.DATABASE_URL_DEV!,
  },
  // Força o uso do schema public para gerenciar migrações, evitando tentativas de criar schemas extras
  migrations: {
    schema: "public",
    table: "__drizzle_migrations",
  },
});
