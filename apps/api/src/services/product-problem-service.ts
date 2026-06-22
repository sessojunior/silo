import { db } from "@silo/database";
import {
  authUser,
  product,
  productProblem,
  productProblemCategory,
  productProblemImage,
  productSolution,
  productSolutionChecked,
  productSolutionImage,
} from "@silo/database/schema";
import { desc, eq, ilike, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

type ProductServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
};

const success = <T>(data: T): ProductServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductServiceError, "ok" | "error" | "status">,
): ProductServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

type ProductProblemRecord = typeof productProblem.$inferSelect;

// Embedding é gerenciado via SQL puro — não faz parte da resposta da API
type ProductProblemListItem = Omit<ProductProblemRecord, "embedding"> & {
  categoryName: string | null;
  categoryColor: string | null;
  userName: string | null;
};

export async function listProductProblems(params: {
  slug: string;
  page?: number;
  limit?: number;
}): Promise<ProductServiceSuccess<{ items: ProductProblemListItem[] }> | ProductServiceError> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  const [foundProduct] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.slug, params.slug))
    .limit(1);

  if (!foundProduct) {
    return failure("Produto não encontrado.", 404);
  }

  const problems = await db
    .select({
      id: productProblem.id,
      productId: productProblem.productId,
      userId: productProblem.userId,
      title: productProblem.title,
      description: productProblem.description,
      problemCategoryId: productProblem.problemCategoryId,
      categoryName: productProblemCategory.name,
      categoryColor: productProblemCategory.color,
      createdAt: productProblem.createdAt,
      updatedAt: productProblem.updatedAt,
      userName: authUser.name,
    })
    .from(productProblem)
    .leftJoin(authUser, eq(productProblem.userId, authUser.id))
    .leftJoin(productProblemCategory, eq(productProblem.problemCategoryId, productProblemCategory.id))
    .where(eq(productProblem.productId, foundProduct.id))
    .orderBy(desc(productProblem.createdAt))
    .limit(limit)
    .offset(offset);

  return success({ items: problems });
}

export async function createProductProblem(data: {
  productId: string;
  userId: string;
  title: string;
  description: string;
  problemCategoryId: string;
}): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  const [category] = await db
    .select({ id: productProblemCategory.id })
    .from(productProblemCategory)
    .where(eq(productProblemCategory.id, data.problemCategoryId))
    .limit(1);

  if (!category) {
    return failure("Categoria não encontrada.", 400);
  }

  await db.insert(productProblem).values({
    id: randomUUID(),
    productId: data.productId,
    userId: data.userId,
    title: data.title.trim(),
    description: data.description.trim(),
    problemCategoryId: data.problemCategoryId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return success(null);
}

export async function updateProductProblem(data: {
  id: string;
  title: string;
  description: string;
  problemCategoryId: string;
}): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  const [updated] = await db
    .update(productProblem)
    .set({
      title: data.title.trim(),
      description: data.description.trim(),
      problemCategoryId: data.problemCategoryId,
      updatedAt: new Date(),
    })
    .where(eq(productProblem.id, data.id))
    .returning();

  if (!updated) {
    return failure("Problema não encontrado.", 404);
  }

  return success(null);
}

export async function deleteProductProblem(id: string): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  await db.transaction(async (tx) => {
    const solutions = await tx.select().from(productSolution).where(eq(productSolution.productProblemId, id));
    const solutionIds = solutions.map((solution) => solution.id);

    if (solutionIds.length > 0) {
      await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutionIds));
      await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds));
      await tx.delete(productSolution).where(eq(productSolution.productProblemId, id));
    }

    await tx.delete(productProblemImage).where(eq(productProblemImage.productProblemId, id));
    await tx.delete(productProblem).where(eq(productProblem.id, id));
  });

  return success(null);
}

type ProductProblemImageRecord = typeof productProblemImage.$inferSelect;

export async function listProductProblemImages(problemId: string): Promise<ProductServiceSuccess<{ items: ProductProblemImageRecord[] }>> {
  const items = await db
    .select()
    .from(productProblemImage)
    .where(eq(productProblemImage.productProblemId, problemId));

  return success({ items });
}

export async function createProductProblemImage(data: {
  productProblemId: string;
  image: string;
  description?: string;
}): Promise<ProductServiceSuccess<{ image: ProductProblemImageRecord }>> {
  const [image] = await db
    .insert(productProblemImage)
    .values({
      id: randomUUID(),
      productProblemId: data.productProblemId,
      image: data.image,
      description: data.description ?? "",
    })
    .returning();

  return success({ image });
}

export async function deleteProductProblemImage(id: string): Promise<ProductServiceSuccess<{ image: ProductProblemImageRecord }> | ProductServiceError> {
  const [image] = await db
    .select()
    .from(productProblemImage)
    .where(eq(productProblemImage.id, id))
    .limit(1);

  if (!image) {
    return failure("Imagem não encontrada.", 404);
  }

  await db.delete(productProblemImage).where(eq(productProblemImage.id, id));

  return success({ image });
}

type ProductProblemCategoryRecord = typeof productProblemCategory.$inferSelect;

export async function listProductProblemCategories(search: string): Promise<ProductServiceSuccess<{ items: ProductProblemCategoryRecord[] }>> {
  const items = await db
    .select()
    .from(productProblemCategory)
    .where(search ? ilike(productProblemCategory.name, `%${search}%`) : undefined)
    .orderBy(productProblemCategory.name);

  return success({ items });
}

export async function createProductProblemCategory(data: {
  name: string;
  color?: string | null;
}): Promise<ProductServiceSuccess<{ category: ProductProblemCategoryRecord }> | ProductServiceError> {
  const name = data.name.trim();
  const [existing] = await db
    .select()
    .from(productProblemCategory)
    .where(eq(productProblemCategory.name, name))
    .limit(1);

  if (existing) {
    return failure("Já existe outra categoria com esse nome.", 400);
  }

  const category = {
    id: randomUUID(),
    name,
    color: data.color || null,
  };

  const [createdCategory] = await db.insert(productProblemCategory).values(category).returning();

  return success({ category: createdCategory });
}

export async function updateProductProblemCategory(data: {
  id: string;
  name: string;
  color?: string | null;
}): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  const name = data.name.trim();
  const [duplicate] = await db
    .select()
    .from(productProblemCategory)
    .where(eq(productProblemCategory.name, name))
    .limit(1);

  if (duplicate && duplicate.id !== data.id) {
    return failure("Já existe outra categoria com esse nome.", 400);
  }

  const [updated] = await db
    .update(productProblemCategory)
    .set({
      name,
      color: data.color || null,
      updatedAt: new Date(),
    })
    .where(eq(productProblemCategory.id, data.id))
    .returning();

  if (!updated) {
    return failure("Categoria não encontrada.", 404);
  }

  return success(null);
}

export async function deleteProductProblemCategory(id: string): Promise<ProductServiceSuccess<null> | ProductServiceError> {
  const [existing] = await db
    .select({ id: productProblemCategory.id })
    .from(productProblemCategory)
    .where(eq(productProblemCategory.id, id))
    .limit(1);

  if (!existing) {
    return failure("Categoria não encontrada.", 404);
  }

  await db.delete(productProblemCategory).where(eq(productProblemCategory.id, id));

  return success(null);
}
