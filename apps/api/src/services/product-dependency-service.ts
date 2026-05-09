import { db } from "@silo/database";
import { productDependency } from "@silo/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

type ProductDependencyRecord = typeof productDependency.$inferSelect;

type ProductDependencyServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductDependencyServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
  retryAfterSeconds?: number;
  resetFlow?: boolean;
};

const success = <T>(data: T): ProductDependencyServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
): ProductDependencyServiceError => ({
  ok: false,
  error,
  status,
});

export type ProductDependencyTreeItem = ProductDependencyRecord & {
  children?: ProductDependencyTreeItem[];
};

export type ProductDependencyCreateInput = {
  productId: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  parentId?: string | null;
};

export type ProductDependencyUpdateInput = {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  parentId?: string | null;
  newPosition?: number;
};

export type ProductDependencyReorderItem = {
  id: string;
  parentId: string | null;
  treePath: string;
  treeDepth: number;
  sortKey: string;
};

const calculateTreePath = (parentPath: string | null, position: number): string => {
  return parentPath ? `${parentPath}/${position}` : `/${position}`;
};

const calculateSortKey = (parentSortKey: string | null, position: number): string => {
  return parentSortKey ? `${parentSortKey}.${position.toString().padStart(3, "0")}` : position.toString().padStart(3, "0");
};

const calculateTreeDepth = (parentDepth: number | null): number => {
  return parentDepth !== null ? parentDepth + 1 : 0;
};

const buildDependencyTree = (
  items: ProductDependencyRecord[],
  parentId: string | null = null,
): ProductDependencyTreeItem[] => {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item,
      children: buildDependencyTree(items, item.id),
    }));
};

export async function listProductDependencies(productId: string): Promise<ProductDependencyServiceSuccess<ProductDependencyTreeItem[]>> {
  const dependencies = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.productId, productId))
    .orderBy(productDependency.sortKey);

  return success(buildDependencyTree(dependencies));
}

export async function createProductDependency(
  data: ProductDependencyCreateInput,
): Promise<ProductDependencyServiceSuccess<{ dependency: ProductDependencyRecord }> | ProductDependencyServiceError> {
  const siblings = await db
    .select()
    .from(productDependency)
    .where(
      and(
        eq(productDependency.productId, data.productId),
        data.parentId
          ? eq(productDependency.parentId, data.parentId)
          : isNull(productDependency.parentId),
      ),
    );

  const nextPosition = siblings.length;
  let parentData: ProductDependencyRecord | null = null;

  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(productDependency)
      .where(eq(productDependency.id, data.parentId))
      .limit(1);
    parentData = parent ?? null;
  }

  const treePath = calculateTreePath(parentData?.treePath ?? null, nextPosition);
  const sortKey = calculateSortKey(parentData?.sortKey ?? null, nextPosition);
  const treeDepth = calculateTreeDepth(parentData?.treeDepth ?? null);

  const [dependency] = await db
    .insert(productDependency)
    .values({
      id: randomUUID(),
      productId: data.productId,
      name: data.name,
      icon: data.icon ?? null,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      treePath,
      treeDepth,
      sortKey,
    })
    .returning();

  return success({ dependency });
}

export async function updateProductDependency(
  data: ProductDependencyUpdateInput,
): Promise<ProductDependencyServiceSuccess<{ dependency: ProductDependencyRecord }> | ProductDependencyServiceError> {
  const existing = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.id, data.id))
    .limit(1);

  if (existing.length === 0) {
    return failure("Dependência não encontrada", 404);
  }

  const updateData: {
    name: string;
    icon: string | null;
    description: string | null;
    updatedAt: Date;
    parentId?: string | null;
    treePath?: string;
    sortKey?: string;
    treeDepth?: number;
  } = {
    name: data.name,
    icon: data.icon ?? null,
    description: data.description ?? null,
    updatedAt: new Date(),
  };

  if (data.newPosition !== undefined) {
    let parentData: ProductDependencyRecord | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select()
        .from(productDependency)
        .where(eq(productDependency.id, data.parentId))
        .limit(1);
      parentData = parent ?? null;
    }

    updateData.parentId = data.parentId ?? null;
    updateData.treePath = calculateTreePath(parentData?.treePath ?? null, data.newPosition);
    updateData.sortKey = calculateSortKey(parentData?.sortKey ?? null, data.newPosition);
    updateData.treeDepth = calculateTreeDepth(parentData?.treeDepth ?? null);
  }

  const [dependency] = await db
    .update(productDependency)
    .set(updateData)
    .where(eq(productDependency.id, data.id))
    .returning();

  if (!dependency) {
    return failure("Dependência não encontrada", 404);
  }

  return success({ dependency });
}

export async function deleteProductDependency(id: string): Promise<ProductDependencyServiceSuccess<null> | ProductDependencyServiceError> {
  const existing = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.id, id))
    .limit(1);

  if (existing.length === 0) {
    return failure("Dependência não encontrada", 404);
  }

  const children = await db
    .select()
    .from(productDependency)
    .where(eq(productDependency.parentId, id));

  if (children.length > 0) {
    return failure("Não é possível excluir uma dependência que possui itens filhos.", 400);
  }

  await db.delete(productDependency).where(eq(productDependency.id, id));

  return success(null);
}

export async function reorderProductDependencies(
  productId: string,
  items: ProductDependencyReorderItem[],
): Promise<ProductDependencyServiceSuccess<null> | ProductDependencyServiceError> {
  const existing = await db
    .select({ id: productDependency.id })
    .from(productDependency)
    .where(eq(productDependency.productId, productId));

  const existingIds = existing.map((item) => item.id);
  const invalidItems = items.filter((item) => !existingIds.includes(item.id));

  if (invalidItems.length > 0) {
    return failure("Alguns itens não pertencem a este produto", 400);
  }

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(productDependency)
        .set({
          parentId: item.parentId,
          treePath: item.treePath,
          treeDepth: item.treeDepth,
          sortKey: item.sortKey,
          updatedAt: new Date(),
        })
        .where(eq(productDependency.id, item.id));
    }
  });

  return success(null);
}