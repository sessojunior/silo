import { z } from "zod";

export const picturePageSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  url: z.string().url("URL inválida"),
  description: z.string().optional().nullable(),
});

export const pictureLinkSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  pageId: z.string().min(1, "ID da página é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  name: z.string().optional().nullable(),
  url: z.string().url("URL inválida"),
  size: z.string().optional().nullable(),
});

export const radarGroupSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  sortOrder: z.number().int().default(0),
});

export const radarSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  groupId: z.string().min(1, "Grupo é obrigatório"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().nullable(),
  webhookUrl: z
    .string()
    .url("URL de webhook inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  logUrl: z
    .string()
    .url("URL de log inválida")
    .optional()
    .nullable()
    .or(z.literal("")),
  active: z.boolean().default(true),
});

export type PicturePageInput = z.infer<typeof picturePageSchema>;
export type RadarGroupInput = z.infer<typeof radarGroupSchema>;
export type RadarInput = z.infer<typeof radarSchema>;
