import { db } from "@silo/database";
import {
  product,
  productActivity,
  productActivityHistory,
  productAvailabilityException,
  productContact,
  productDependency,
  productManual,
  productProblem,
  productProblemImage,
  productSolution,
  productSolutionChecked,
  productSolutionImage,
} from "@silo/database/schema";
import { asc, eq, inArray, like } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { ShiftCode } from "@silo/engine/domain/scheduling";

export function formatSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ProductListItem = typeof product.$inferSelect;

type ProductCoreServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductCoreServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
};

const success = <T>(data: T): ProductCoreServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductCoreServiceError, "ok" | "error" | "status">,
): ProductCoreServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

export async function listProducts(opts: {
  slug?: string;
  name?: string;
  page?: number;
  limit?: number;
}): Promise<ProductCoreServiceSuccess<ProductListItem[]>> {
  const { slug, name, page = 1, limit = 40 } = opts;

  if (slug) {
    return success(await db.select().from(product).where(eq(product.slug, slug)).limit(1));
  }

  const offset = (page - 1) * limit;
  const where = name ? like(product.name, `%${name}%`) : undefined;
  const rows = where
    ? await db.select().from(product).where(where).orderBy(asc(product.name)).limit(limit).offset(offset)
    : await db.select().from(product).orderBy(asc(product.name)).limit(limit).offset(offset);

  return success(rows);
}

export async function createProduct(data: {
  name: string;
  slug?: string;
  available: boolean;
  priority: string;
  turns: ShiftCode[];
  description?: string | null;
  urlProductFlow?: string | null;
}): Promise<ProductCoreServiceSuccess<null> | ProductCoreServiceError> {
  const name = data.name.trim();
  const slug = formatSlug(data.slug || name);
  const existing = await db.select().from(product).where(like(product.slug, slug)).limit(1);

  if (existing.length > 0 && existing[0].slug === slug) {
    return failure("Já existe um produto com este slug.", undefined, { field: "name" });
  }

  await db.insert(product).values({
    id: randomUUID(),
    name,
    slug,
    available: data.available,
    priority: data.priority,
    turns: data.turns,
    description: data.description ?? null,
    urlProductFlow: data.urlProductFlow ?? null,
  });

  return success(null);
}

export async function updateProduct(data: {
  id: string;
  name: string;
  slug?: string;
  available: boolean;
  priority: string;
  turns: ShiftCode[];
  description?: string | null;
  urlProductFlow?: string | null;
}): Promise<ProductCoreServiceSuccess<null> | ProductCoreServiceError> {
  const name = data.name.trim();
  const slug = formatSlug(data.slug || name);
  const existing = await db.select().from(product).where(like(product.slug, slug)).limit(1);

  if (existing.length > 0 && existing[0].id !== data.id && existing[0].slug === slug) {
    return failure("Já existe um produto com este slug.");
  }

  const result = await db
    .update(product)
    .set({
      name,
      slug,
      available: data.available,
      priority: data.priority,
      turns: data.turns,
      description: data.description ?? null,
      urlProductFlow: data.urlProductFlow ?? null,
    })
    .where(eq(product.id, data.id));

  if (!result.rowCount) {
    return failure("Produto não encontrado.", 404);
  }

  return success(null);
}

export async function deleteProduct(id: string): Promise<ProductCoreServiceSuccess<null> | ProductCoreServiceError> {
  const existing = await db.select().from(product).where(eq(product.id, id)).limit(1);

  if (existing.length === 0) {
    return failure("Produto não encontrado.", 404);
  }

  await db.transaction(async (tx) => {
    const activities = await tx.select({ id: productActivity.id }).from(productActivity).where(eq(productActivity.productId, id));
    const activityIds = activities.map((activity) => activity.id);

    if (activityIds.length > 0) {
      await tx.delete(productActivityHistory).where(inArray(productActivityHistory.productActivityId, activityIds));
    }

    await tx.delete(productActivity).where(eq(productActivity.productId, id));

    const problems = await tx.select({ id: productProblem.id }).from(productProblem).where(eq(productProblem.productId, id));
    const problemIds = problems.map((problem) => problem.id);

    if (problemIds.length > 0) {
      const solutions = await tx.select({ id: productSolution.id }).from(productSolution).where(inArray(productSolution.productProblemId, problemIds));
      const solutionIds = solutions.map((solution) => solution.id);

      if (solutionIds.length > 0) {
        await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutionIds));
        await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds));
      }

      await tx.delete(productSolution).where(inArray(productSolution.productProblemId, problemIds));
      await tx.delete(productProblemImage).where(inArray(productProblemImage.productProblemId, problemIds));
      await tx.delete(productProblem).where(eq(productProblem.productId, id));
    }

    await tx.delete(productAvailabilityException).where(eq(productAvailabilityException.productId, id));
    await tx.delete(productDependency).where(eq(productDependency.productId, id));
    await tx.delete(productManual).where(eq(productManual.productId, id));
    await tx.delete(productContact).where(eq(productContact.productId, id));
    await tx.delete(product).where(eq(product.id, id));
  });

  return success(null);
}