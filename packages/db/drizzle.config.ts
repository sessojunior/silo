import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const isProd = process.env.NODE_ENV === "production";

const drizzleDatabaseUrl = process.env.DRIZZLE_DATABASE_URL;

const databaseUrl = isProd
  ? process.env.DATABASE_URL_PROD
  : process.env.DATABASE_URL_DEV;

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      drizzleDatabaseUrl ||
      databaseUrl ||
      process.env.DATABASE_URL_PROD ||
      process.env.DATABASE_URL_DEV!,
  },
  migrations: {
    schema: "public",
    table: "__drizzle_migrations",
  },
});
