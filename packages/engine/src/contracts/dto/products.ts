import { z } from "zod";
import type { ShiftCode } from "../../domain/scheduling/index.js";
import { SHIFT_CODES } from "../../domain/scheduling/index.js";

export const ProductPriorityValues = ["low", "normal", "high", "urgent"] as const;
export type ProductPriority = (typeof ProductPriorityValues)[number];

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().min(1),
  available: z.boolean().optional().default(true),
  priority: z.enum(ProductPriorityValues).optional().default("normal"),
  turns: z.array(z.enum(SHIFT_CODES)).optional().default([...SHIFT_CODES]),
  urlProductFlow: z.string().url().optional().nullable(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  available: boolean;
  priority: ProductPriority;
  turns: ShiftCode[];
  urlProductFlow: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductProblemDto {
  id: string;
  productId: string;
  userId: string;
  title: string;
  description: string;
  problemCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductProblemImageDto {
  id: string;
  productProblemId: string;
  image: string;
  description: string;
}
