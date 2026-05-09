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

const groupBaseRouteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(50, "Nome deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),

  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const groupListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

export const groupDeleteQuerySchema = z.object({
  id: z.string().min(1, "ID é obrigatório."),
});

export const groupPermissionsQuerySchema = z.object({
  groupId: z.string().min(1, "groupId é obrigatório."),
});

export const groupPermissionUpdateSchema = z.object({
  groupId: z.string().min(1, "groupId é obrigatório."),
  resource: z.string().min(1, "resource é obrigatório."),
  action: z.string().min(1, "action é obrigatório."),
  enabled: z.boolean(),
});

export const groupRemoveUserSchema = z.object({
  userId: z.string().min(1, "userId é obrigatório."),
  groupId: z.string().min(1, "groupId é obrigatório."),
});

export const groupCreateSchema = groupBaseRouteSchema;

export const groupUpdateSchema = groupBaseRouteSchema.extend({
  id: z.string().min(1, "ID é obrigatório"),
});
