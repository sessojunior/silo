import { db } from "@silo/database";

type WorkerDbClient = Pick<typeof db, "select" | "update">;

const hasWorkerDbClient = (value: unknown): value is WorkerDbClient => {
  if (typeof value !== "object" || value === null) return false;
  return "select" in value && "update" in value;
};

export const resolveWorkerDbClient = (tx?: unknown): WorkerDbClient => {
  return hasWorkerDbClient(tx) ? tx : db;
};