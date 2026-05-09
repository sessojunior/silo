import { z } from "zod";

const contactStatusValues = ["active", "inactive"] as const;

export const contactSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  email: z.string().email("Email inválido").optional(),

  phone: z
    .string()
    .regex(
      /^[\d\s\(\)\-\+]+$/,
      "Telefone deve conter apenas números, espaços, parênteses, hífens e +",
    )
    .optional(),

  role: z
    .string()
    .min(2, "Cargo deve ter pelo menos 2 caracteres")
    .max(50, "Cargo deve ter no máximo 50 caracteres"),

  department: z
    .string()
    .max(50, "Departamento deve ter no máximo 50 caracteres")
    .optional(),

  notes: z
    .string()
    .max(500, "Observações devem ter no máximo 500 caracteres")
    .optional(),
});

const contactBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),

  role: z
    .string()
    .trim()
    .min(2, "Função deve ter pelo menos 2 caracteres")
    .max(100, "Função deve ter no máximo 100 caracteres"),

  team: z
    .string()
    .trim()
    .min(2, "Equipe deve ter pelo menos 2 caracteres")
    .max(100, "Equipe deve ter no máximo 100 caracteres"),

  email: z.string().trim().toLowerCase().email("Email inválido"),

  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  imageUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  active: z.boolean().optional().default(true),
});

export const contactListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(contactStatusValues).optional(),
});

export const contactCreateSchema = contactBaseSchema;

export const contactUpdateSchema = contactBaseSchema.extend({
  id: z.string().trim().min(1, "ID é obrigatório"),
  removeImage: z.boolean().optional().default(false),
});

export const contactDeleteSchema = z.object({
  id: z.string().trim().min(1, "ID é obrigatório"),
});
