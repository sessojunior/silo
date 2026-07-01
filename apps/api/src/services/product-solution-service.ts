import { db } from "@silo/database";
import { authUser, product, productProblem, productSolution, productSolutionChecked, productSolutionImage } from "@silo/database/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { upsertSolutionEmbedding } from "./embedding-write-service.js";

type ProductSolutionServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductSolutionServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
};

const success = <T>(data: T): ProductSolutionServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductSolutionServiceError, "ok" | "error" | "status">,
): ProductSolutionServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

type ProductSolutionImageRecord = typeof productSolutionImage.$inferSelect;

type ProductSolutionListItem = {
  id: string;
  replyId: string | null;
  date: Date;
  description: string;
  verified: boolean;
  user: {
    id: string;
    name: string;
    image: string;
  };
  images: ProductSolutionImageRecord[];
  isMine: boolean;
};

export async function listProductSolutions(problemId: string): Promise<ProductSolutionServiceSuccess<{ items: ProductSolutionListItem[] }>> {
  const solutions = await db
    .select()
    .from(productSolution)
    .where(eq(productSolution.productProblemId, problemId))
    .orderBy(desc(productSolution.createdAt), desc(productSolution.id));

  const userIds = [...new Set(solutions.map((solution) => solution.userId))];
  const users = userIds.length ? await db.select().from(authUser).where(inArray(authUser.id, userIds)) : [];
  const checked = solutions.length
    ? await db.select().from(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, solutions.map((solution) => solution.id)))
    : [];
  const checkedIds = new Set(checked.map((item) => item.productSolutionId));
  const solutionIds = solutions.map((solution) => solution.id);
  const images = solutionIds.length
    ? await db.select().from(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, solutionIds))
    : [];

  const items = solutions.map((solution) => {
    const user = users.find((item) => item.id === solution.userId);

    return {
      id: solution.id,
      replyId: solution.replyId,
      date: solution.createdAt,
      description: solution.description,
      verified: checkedIds.has(solution.id),
      user: user
        ? { id: solution.userId, name: user.name ?? "", image: "/images/profile.png" }
        : { id: solution.userId, name: "Usuário desconhecido", image: "/images/profile.png" },
      images: images.filter((image) => image.productSolutionId === solution.id),
      isMine: false,
    } satisfies ProductSolutionListItem;
  });

  return success({ items });
}

export async function createProductSolution(data: {
  userId: string;
  problemId: string;
  description: string;
  replyId?: string | null;
  imageUrl?: string | null;
}): Promise<ProductSolutionServiceSuccess<null> | ProductSolutionServiceError> {
  const solutionId = randomUUID();

  await db.insert(productSolution).values({
    id: solutionId,
    userId: data.userId,
    productProblemId: data.problemId,
    description: data.description,
    replyId: data.replyId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (data.imageUrl) {
    await db.insert(productSolutionImage).values({
      id: randomUUID(),
      productSolutionId: solutionId,
      image: data.imageUrl,
      description: "",
    });
  }

  // Dispara geração de embedding em background
  upsertSolutionEmbedding(solutionId, data.description).catch(
    (err) => console.warn("⚠️ [SOLUTION] Embedding background failed:", err instanceof Error ? err.message : String(err)),
  );

  return success(null);
}

export async function updateProductSolution(data: {
  userId: string;
  id: string;
  description: string;
  imageUrl?: string | null;
  removeImage?: boolean;
}): Promise<ProductSolutionServiceSuccess<null> | ProductSolutionServiceError> {
  const [solution] = await db.select().from(productSolution).where(eq(productSolution.id, data.id)).limit(1);

  if (!solution || solution.userId !== data.userId) {
    return failure("Permissão negada.", 403);
  }

  await db.update(productSolution).set({ description: data.description, updatedAt: new Date() }).where(eq(productSolution.id, data.id));

  if (data.imageUrl) {
    await db.delete(productSolutionImage).where(eq(productSolutionImage.productSolutionId, data.id));
    await db.insert(productSolutionImage).values({
      id: randomUUID(),
      productSolutionId: data.id,
      image: data.imageUrl,
      description: "",
    });
  } else if (data.removeImage) {
    await db.delete(productSolutionImage).where(eq(productSolutionImage.productSolutionId, data.id));
  }

  // Atualiza embedding em background
  upsertSolutionEmbedding(data.id, data.description).catch(
    (err) => console.warn("⚠️ [SOLUTION] Embedding background update failed:", err instanceof Error ? err.message : String(err)),
  );

  return success(null);
}

export async function deleteProductSolution(data: {
  userId: string;
  id: string;
}): Promise<ProductSolutionServiceSuccess<null> | ProductSolutionServiceError> {
  const [solution] = await db.select().from(productSolution).where(eq(productSolution.id, data.id)).limit(1);

  if (!solution || solution.userId !== data.userId) {
    return failure("Permissão negada.", 403);
  }

  await db.transaction(async (tx) => {
    const getAllChildReplies = async (parentId: string): Promise<string[]> => {
      const directReplies = await tx.select().from(productSolution).where(eq(productSolution.replyId, parentId));
      let all = directReplies.map((reply) => reply.id);

      for (const reply of directReplies) {
        all = all.concat(await getAllChildReplies(reply.id));
      }

      return all;
    };

    const childReplyIds = await getAllChildReplies(data.id);
    const allIds = [data.id, ...childReplyIds];

    await tx.delete(productSolutionChecked).where(inArray(productSolutionChecked.productSolutionId, allIds));
    await tx.delete(productSolutionImage).where(inArray(productSolutionImage.productSolutionId, allIds));
    await tx.delete(productSolution).where(inArray(productSolution.id, allIds));
  });

  return success(null);
}

export async function countProductSolutions(problemIds: string[]): Promise<ProductSolutionServiceSuccess<Record<string, number>>> {
  const result = await db
    .select({ problemId: productSolution.productProblemId, count: sql<number>`COUNT(${productSolution.id})` })
    .from(productSolution)
    .where(inArray(productSolution.productProblemId, problemIds))
    .groupBy(productSolution.productProblemId);

  const counts: Record<string, number> = {};
  problemIds.forEach((id) => {
    counts[id] = 0;
  });

  result.forEach((row) => {
    counts[row.problemId] = Number(row.count);
  });

  return success(counts);
}

export async function getProductSolutionsSummary(productSlug: string): Promise<ProductSolutionServiceSuccess<{ totalSolutions: number; lastUpdated: Date | null }>> {
  const [result] = await db
    .select({
      totalSolutions: sql<number>`COUNT(${productSolution.id})`,
      lastUpdated: sql<Date | null>`MAX(GREATEST(${productProblem.updatedAt}, COALESCE(${productSolution.updatedAt}, ${productProblem.updatedAt})))`,
    })
    .from(product)
    .leftJoin(productProblem, eq(productProblem.productId, product.id))
    .leftJoin(productSolution, eq(productSolution.productProblemId, productProblem.id))
    .where(eq(product.slug, productSlug))
    .groupBy(product.id);

  if (!result) {
    return success({ totalSolutions: 0, lastUpdated: null });
  }

  return success({ totalSolutions: Number(result.totalSolutions) || 0, lastUpdated: result.lastUpdated });
}

export async function listProductSolutionImages(solutionId: string): Promise<ProductSolutionServiceSuccess<{ items: ProductSolutionImageRecord[] }>> {
  const items = await db
    .select()
    .from(productSolutionImage)
    .where(eq(productSolutionImage.productSolutionId, solutionId));

  return success({ items });
}

export async function createProductSolutionImage(data: {
  productSolutionId: string;
  image: string;
  description?: string;
}): Promise<ProductSolutionServiceSuccess<{ image: ProductSolutionImageRecord }>> {
  const [image] = await db
    .insert(productSolutionImage)
    .values({
      id: randomUUID(),
      productSolutionId: data.productSolutionId,
      image: data.image,
      description: data.description ?? "",
    })
    .returning();

  return success({ image });
}

export async function deleteProductSolutionImage(id: string): Promise<ProductSolutionServiceSuccess<{ image: ProductSolutionImageRecord }> | ProductSolutionServiceError> {
  const [image] = await db
    .select()
    .from(productSolutionImage)
    .where(eq(productSolutionImage.id, id))
    .limit(1);

  if (!image) {
    return failure("Imagem não encontrada.", 404);
  }

  await db.delete(productSolutionImage).where(eq(productSolutionImage.id, id));

  return success({ image });
}