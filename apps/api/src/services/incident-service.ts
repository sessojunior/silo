import { db } from "@silo/database";
import { productProblemCategory, productActivity, productProblem } from "@silo/database/schema";
import { eq, ne, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { deleteUploadFile, getUploadsRoot, isSafeFilename, storeBufferAsWebp } from "../infra/uploads.js";

const NO_INCIDENTS_CATEGORY_ID = "no_incidents";

type IncidentServiceSuccess<T> = {
  ok: true;
  data: T;
};

type IncidentServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
};

const success = <T>(data: T): IncidentServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<IncidentServiceError, "ok" | "error" | "status">,
): IncidentServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

export async function listIncidents() {
  return db
    .select()
    .from(productProblemCategory)
    .where(ne(productProblemCategory.id, NO_INCIDENTS_CATEGORY_ID))
    .orderBy(productProblemCategory.sortOrder, productProblemCategory.name);
}

export async function createIncident(data: { name: string; color?: string }) {
  const name = data.name.trim();
  const existing = await db
    .select()
    .from(productProblemCategory)
    .where(eq(productProblemCategory.name, name))
    .limit(1);
  if (existing.length > 0) return failure("Nome de incidente já existe.", 400);

  const newIncident = {
    id: randomUUID(),
    name,
    color: data.color || "#6B7280",
    isSystem: false,
    sortOrder: 999,
  };
  await db.insert(productProblemCategory).values(newIncident);
  return success(newIncident);
}

export async function updateIncident(data: { id: string; name: string; color?: string }) {
  const { id, name, color } = data;
  if (id === NO_INCIDENTS_CATEGORY_ID) {
    return failure("Não é possível editar esta categoria.", 400);
  }

  const existing = await db
    .select()
    .from(productProblemCategory)
    .where(and(eq(productProblemCategory.name, name.trim()), ne(productProblemCategory.id, id)))
    .limit(1);
  if (existing.length > 0) return failure("Nome de incidente já existe.", 400);

  await db
    .update(productProblemCategory)
    .set({ name: name.trim(), color: color || "#6B7280", updatedAt: new Date() })
    .where(eq(productProblemCategory.id, id));
  return success(null);
}

export async function deleteIncident(id: string) {
  const category = await db
    .select({ isSystem: productProblemCategory.isSystem, name: productProblemCategory.name })
    .from(productProblemCategory)
    .where(eq(productProblemCategory.id, id))
    .limit(1);

  if (category.length === 0) return failure("Incidente não encontrado.", 404);
  if (category[0].isSystem) {
    return failure(`"${category[0].name}" é uma categoria do sistema e não pode ser excluída.`, 400);
  }

  const usageInActivities = await db.select({ id: productActivity.id }).from(productActivity).where(eq(productActivity.problemCategoryId, id));
  const usageInProblems = await db.select({ id: productProblem.id }).from(productProblem).where(eq(productProblem.problemCategoryId, id));
  const totalUsage = usageInActivities.length + usageInProblems.length;

  if (totalUsage > 0) {
    const message = totalUsage === 1
      ? "Este incidente está sendo usado em 1 registro e não pode ser excluído."
      : `Este incidente está sendo usado em ${totalUsage} registros e não pode ser excluído.`;
    return failure(message, 400);
  }

  await db.delete(productProblemCategory).where(eq(productProblemCategory.id, id));
  return success(null);
}

export async function getIncidentUsage(id: string) {
  const usageInActivities = await db.select({ id: productActivity.id }).from(productActivity).where(eq(productActivity.problemCategoryId, id));
  const usageInProblems = await db.select({ id: productProblem.id }).from(productProblem).where(eq(productProblem.problemCategoryId, id));
  const totalUsage = usageInActivities.length + usageInProblems.length;

  return success({
    inUse: totalUsage > 0,
    usageCount: totalUsage,
    usageDetails: {
      activities: usageInActivities.length,
      problems: usageInProblems.length,
    },
  });
}

type IncidentImageItem = {
  filename: string;
  url: string;
  size: number;
  mtime: number;
};

export async function listIncidentImages(): Promise<{ items: IncidentImageItem[] }> {
  const dir = path.join(getUploadsRoot(), "incidents");
  let files: string[] = [];

  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }

  const stats = await Promise.all(
    files.map(async (filename) => {
      try {
        const stat = await fs.stat(path.join(dir, filename));
        return { filename, url: `/uploads/incidents/${filename}`, size: stat.size, mtime: stat.mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  const items = stats
    .filter((item): item is IncidentImageItem => item !== null)
    .sort((a, b) => b.mtime - a.mtime);

  return { items };
}

export async function createIncidentImage(data: { image: string; filename: string }): Promise<IncidentServiceSuccess<{ filename: string; url: string }> | IncidentServiceError> {
  if (!isSafeFilename(data.filename)) {
    return failure("Nome de arquivo inválido", 400);
  }

  const buffer = Buffer.from(data.image.replace(/^data:[^;]+;base64,/, ""), "base64");
  const stored = await storeBufferAsWebp("incidents", data.filename, buffer);

  if (typeof stored !== "string") {
    return failure(stored.error, 400);
  }

  return success({ filename: stored, url: `/uploads/incidents/${stored}` });
}

export async function deleteIncidentImage(filename: string): Promise<IncidentServiceSuccess<null> | IncidentServiceError> {
  if (!isSafeFilename(filename)) {
    return failure("Nome de arquivo inválido", 400);
  }

  await deleteUploadFile("incidents", filename);
  return success(null);
}
