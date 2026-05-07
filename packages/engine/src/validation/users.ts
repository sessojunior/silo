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
