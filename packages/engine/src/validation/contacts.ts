import { z } from "zod";

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
