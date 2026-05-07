import { z } from "zod";
import { SHIFT_CODES } from "../domain/scheduling/index.js";
import { priorityEnumValues } from "./shared.js";

const productPriorityEnumValues = ["low", "normal", "high", "urgent"] as const;
const problemStatusEnumValues = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;

export const problemSchema = z.object({
  title: z
    .string()
    .min(5, "Título deve ter pelo menos 5 caracteres")
    .max(120, "Título deve ter no máximo 120 caracteres"),

  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(5000, "Descrição deve ter no máximo 5000 caracteres"),

  categoryId: z.string().uuid("ID de categoria inválido"),

  priority: z.enum(priorityEnumValues, {
    error: () => ({
      message: "Prioridade deve ser: low, medium, high ou urgent",
    }),
  }),

  status: z.enum(problemStatusEnumValues, {
    error: () => ({
      message: "Status deve ser: open, in_progress, resolved ou closed",
    }),
  }),
});

export const solutionSchema = z.object({
  description: z
    .string()
    .min(10, "Descrição deve ter pelo menos 10 caracteres")
    .max(5000, "Descrição deve ter no máximo 5000 caracteres"),

  verified: z.boolean().optional().default(false),

  images: z
    .array(
      z.object({
        image: z.string().url("URL da imagem inválida"),
        description: z
          .string()
          .max(500, "Descrição da imagem deve ter no máximo 500 caracteres"),
      }),
    )
    .optional()
    .default([]),
});

const productBaseSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  description: z
    .string()
    .max(2000, "Descrição deve ter no máximo 2000 caracteres")
    .nullable()
    .optional(),

  slug: z
    .string()
    .min(3, "Slug deve ter pelo menos 3 caracteres")
    .max(50, "Slug deve ter no máximo 50 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    )
    .optional(),

  available: z.boolean().optional().default(true),

  priority: z
    .enum(productPriorityEnumValues, {
      error: () => ({
        message: "Prioridade deve ser: low, normal, high ou urgent",
      }),
    })
    .optional()
    .default("normal"),

  turns: z
    .array(z.enum(SHIFT_CODES))
    .min(1, "Deve selecionar ao menos um turno")
    .default([...SHIFT_CODES]),
  url_product_flow: z
    .string()
    .url("URL do fluxo de dados inválida")
    .nullable()
    .optional(),
});

export const productSchema = productBaseSchema;
export const productCreateSchema = productBaseSchema;
export const productUpdateSchema = productBaseSchema.extend({
  id: z.string().min(1, "ID do produto é obrigatório"),
});
