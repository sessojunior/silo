import type { Request, Response as ExpressResponse } from "express";
import { isDatabaseInfrastructureUnavailable } from "@silo/database";
import { isValidDomain } from "../../auth/setup.js";
import { z } from "zod";
import {
  authEmailSchema,
  authNameSchema,
  authOtpCodeSchema,
  authStrongPasswordSchema,
} from "@silo/engine/validation/auth";

export const getRequestIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers["x-real-ip"];
  if (typeof real === "string") return real.trim();
  return req.ip ?? "unknown";
};

export const buildHeaders = (req: Request): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
};

export const authAllowedEmailSchema = authEmailSchema.superRefine((value, ctx) => {
  if (!isValidDomain(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas e-mails do domínio permitido são aceitos." });
  }
});

export const authEmailSendOtpSchema = z.object({
  email: authAllowedEmailSchema,
  resend: z.boolean().optional(),
});

export const authEmailVerifyOtpSchema = z.object({
  email: authAllowedEmailSchema,
  code: authOtpCodeSchema,
});

export const authSignUpEmailSchema = z.object({
  name: authNameSchema,
  email: authAllowedEmailSchema,
  password: authStrongPasswordSchema,
});

export const authSignUpEmailVerifyOtpSchema = z.object({
  email: authAllowedEmailSchema,
  code: authOtpCodeSchema,
  password: z.string().min(8).max(160).optional(),
  autoSignIn: z.boolean().optional(),
});

export const respondAuthInfrastructureError = (res: ExpressResponse, err: unknown): boolean => {
  if (!isDatabaseInfrastructureUnavailable(err)) {
    return false;
  }

  res.status(503).json({ success: false, error: "Serviço de autenticação temporariamente indisponível." });
  return true;
};

export const appendSetCookieHeaders = (res: ExpressResponse, cookies?: string[]): void => {
  for (const cookie of cookies ?? []) {
    res.append("set-cookie", cookie);
  }
};