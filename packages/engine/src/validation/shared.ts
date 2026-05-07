import { z } from "zod";

export const priorityEnumValues = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const dateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data final deve ser maior ou igual à data inicial",
    path: ["endDate"],
  });

export const paginationSchema = z.object({
  page: z.number().min(1, "Página deve ser maior que 0").default(1),

  limit: z
    .number()
    .min(1, "Limite deve ser maior que 0")
    .max(100, "Limite máximo é 100")
    .default(20),

  search: z
    .string()
    .max(100, "Termo de busca deve ter no máximo 100 caracteres")
    .optional(),

  sortBy: z
    .string()
    .max(50, "Campo de ordenação deve ter no máximo 50 caracteres")
    .optional(),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
