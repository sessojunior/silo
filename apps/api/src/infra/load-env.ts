import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, "../../../../.env");

// Garante variáveis do monorepo em execuções iniciadas dentro de apps/api.
dotenv.config({ path: rootEnvPath });
dotenv.config();
