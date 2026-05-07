import { z } from "zod";

export const groupSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),

  description: z
    .string()
    .max(200, "Descrição deve ter no máximo 200 caracteres")
    .optional(),

  color: z
    .string()
    .regex(
      /^#[0-9A-Fa-f]{6}$/,
      "Cor deve estar no formato hexadecimal (#RRGGBB)",
    )
    .optional(),

  isDefault: z.boolean().optional().default(false),
});
