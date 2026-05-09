import { z } from "zod";

export const userSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),

  email: z
    .string()
    .email("Email inválido")
    .endsWith("@inpe.br", "Apenas e-mails do domínio @inpe.br são permitidos"),

  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número",
    ),

  groups: z
    .array(z.string().uuid("ID de grupo inválido"))
    .min(1, "Usuário deve pertencer a pelo menos um grupo"),
});

const userFullNameSchema = z
  .string()
  .trim()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .max(100, "Nome deve ter no máximo 100 caracteres");

const userEmailValueSchema = z
  .string()
  .email("Email inválido")
  .transform((value) => value.trim().toLowerCase());

const userGroupEntrySchema = z.object({ groupId: z.string() });

const isValidUserProfileName = (name: string): boolean =>
  /^[A-Za-zÀ-ÿ\s]{3,}$/.test(name.trim()) && name.trim().includes(" ");

export const userListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  groupId: z.string().trim().optional(),
});

export const userDeleteQuerySchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
});

export const userIdParamSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
});

export const userCreateSchema = z.object({
  name: userFullNameSchema,
  email: userEmailValueSchema,
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
  groupId: z.string().optional(),
  groups: z.array(userGroupEntrySchema).optional(),
});

export const userUpdateSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  name: userFullNameSchema,
  email: userEmailValueSchema,
  emailVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  groupId: z.string().optional(),
  groups: z.array(userGroupEntrySchema).optional(),
});

export const userProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .refine(isValidUserProfileName, "O nome precisa ser completo e conter apenas letras."),
  genre: z.string().trim().min(1, "Gênero é obrigatório."),
  role: z.string().trim().min(1, "Função é obrigatória."),
  phone: z.string().trim().min(1, "Telefone é obrigatório."),
  company: z.string().trim().min(1, "Empresa é obrigatória."),
  location: z.string().trim().min(1, "Localização é obrigatória."),
  team: z.string().trim().min(1, "Equipe é obrigatória."),
});

export const userPreferencesSchema = z.object({ chatEnabled: z.boolean() });

export const userPasswordSchema = z.object({
  password: z.string().min(8, "A senha é inválida."),
});

export const userEmailSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .transform((value) => value.trim().toLowerCase()),
});

export const userEmailChangeConfirmSchema = z.object({
  code: z.string().trim().min(1, "Código inválido."),
  newEmail: z
    .string()
    .email("Email inválido")
    .transform((value) => value.trim().toLowerCase()),
});

export const userProfileImageUpdateSchema = z.object({
  imageUrl: z.string().trim().min(1, "URL da imagem não fornecida."),
});
