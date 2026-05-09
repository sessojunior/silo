import { z } from "zod";

export const authEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Digite um e-mail válido.");

export const authOtpCodeSchema = z
  .string()
  .trim()
  .length(6, "Digite o código com 6 caracteres.");

export const authPlainPasswordSchema = z
  .string()
  .min(1, "Digite sua senha.");

export const authStrongPasswordSchema = z
  .string()
  .min(8, "Senha inválida.")
  .max(120)
  .refine(
    (value) =>
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[^A-Za-z0-9]/.test(value),
    "Senha inválida.",
  );

export const authNameSchema = z
  .string()
  .trim()
  .min(2, "Digite um nome válido.")
  .max(120, "Digite um nome válido.")
  .regex(/^[\p{L}\s'-]{2,120}$/u, "Digite um nome válido.");

export const authForgetPasswordSchema = z.object({
  email: authEmailSchema,
  resend: z.boolean().optional(),
});

export const authVerifyForgetPasswordOtpSchema = z.object({
  email: authEmailSchema,
  code: authOtpCodeSchema,
});

export const authLoginPasswordSchema = z.object({
  email: authEmailSchema,
  password: authPlainPasswordSchema,
});

export const authSetupPasswordSchema = z.object({
  email: authEmailSchema,
  code: authOtpCodeSchema,
  password: authStrongPasswordSchema,
  autoSignIn: z.boolean().optional(),
});