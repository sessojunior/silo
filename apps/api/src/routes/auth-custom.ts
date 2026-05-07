import { Router } from "express";
import { z } from "zod";
import type { Request, Response as ExpressResponse } from "express";
import { isValidDomain } from "../auth/setup.js";
import { isDatabaseInfrastructureUnavailable } from "@silo/database";
import { createSignUpEmail, completePasswordSetup, getCurrentSession, loginWithGoogle, sendForgetPasswordOtp, sendLoginEmailOtp, sendSignUpEmailOtp, signInWithPassword, verifyForgetPasswordOtp, verifyLoginEmailOtp, verifySignUpEmailOtp } from "../services/auth-custom-service.js";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
const getRequestIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers["x-real-ip"];
  if (typeof real === "string") return real.trim();
  return req.ip ?? "unknown";
};

const isValidPassword = (password: string): boolean =>
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const isValidName = (name: string): boolean => /^[\p{L}\s'-]{2,120}$/u.test(name);

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Builds a node-compatible headers object from Express request headers
const buildHeaders = (req: Request): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.join(", ");
  }
  return out;
};

type AuthServiceErrorResult = {
  error: unknown;
  status?: number;
  field?: string;
  retryAfterSeconds?: number;
  resetFlow?: boolean;
};

const respondAuthServiceError = (
  res: ExpressResponse,
  result: unknown,
  fallbackMessage: string,
): boolean => {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return false;
  }

  const errorResult = result as AuthServiceErrorResult;
  const status = typeof errorResult.status === "number" ? errorResult.status : 400;
  const retryAfterSeconds = typeof errorResult.retryAfterSeconds === "number" ? errorResult.retryAfterSeconds : undefined;
  const payload: { success: false; error: string; field?: string; retryAfterSeconds?: number; resetFlow?: boolean } = {
    success: false,
    error: typeof errorResult.error === "string" ? errorResult.error : fallbackMessage,
  };

  if (typeof errorResult.field === "string") payload.field = errorResult.field;
  if (retryAfterSeconds !== undefined) payload.retryAfterSeconds = retryAfterSeconds;
  if (typeof errorResult.resetFlow === "boolean") payload.resetFlow = errorResult.resetFlow;
  if (retryAfterSeconds !== undefined && status === 429) res.set("Retry-After", String(retryAfterSeconds));

  res.status(status).json(payload);
  return true;
};

const respondAuthInfrastructureError = (res: ExpressResponse, err: unknown): boolean => {
  if (!isDatabaseInfrastructureUnavailable(err)) {
    return false;
  }

  res.status(503).json({ success: false, error: "Serviço de autenticação temporariamente indisponível." });
  return true;
};

const appendSetCookieHeaders = (res: ExpressResponse, cookies?: string[]): void => {
  for (const cookie of cookies ?? []) {
    res.append("set-cookie", cookie);
  }
};

type ValidationErrorResult = {
  error: {
    issues: Array<{ message: string }>;
  };
};

const respondAuthValidationError = (
  res: ExpressResponse,
  result: ValidationErrorResult,
  fallbackMessage: string,
  field?: string,
): void => {
  const payload: { success: false; error: string; field?: string } = {
    success: false,
    error: result.error.issues[0]?.message ?? fallbackMessage,
  };

  if (field) payload.field = field;
  res.status(400).json(payload);
};

// ─── POST /api/auth/forget-password ───────────────────────────────────────────
router.post("/forget-password", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email(),
      resend: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      respondAuthValidationError(res, parsed, "Dados inválidos.");
      return;
    }
    const { email, resend } = parsed.data;
    const ip = getRequestIp(req);
    const result = await sendForgetPasswordOtp({ email, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao enviar código.")) {
      return;
    }

    res.json({ success: true, data: { step: 2, email: result.email, cooldownSeconds: result.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] forget-password:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao enviar código." });
  }
});

// ─── POST /api/auth/forget-password/verify-otp ────────────────────────────────
router.post("/forget-password/verify-otp", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().trim().length(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, code } = parsed.data;
    const ip = getRequestIp(req);
    const result = await verifyForgetPasswordOtp({ email, code, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao verificar código.")) {
      return;
    }

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] forget-password/verify-otp:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao verificar código." });
  }
});

// ─── POST /api/auth/login/password ────────────────────────────────────────────
router.post("/login/password", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1, "Digite sua senha.") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, password } = parsed.data;
    const ip = getRequestIp(req);

    const result = await signInWithPassword({ email, password, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao entrar.")) {
      return;
    }

    appendSetCookieHeaders(res, result.setCookieHeaders);
    res.json({ success: true, data: { signedIn: true }, message: "Login realizado com sucesso!" });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] login/password:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao entrar." });
  }
});

// ─── GET /api/auth/get-session ───────────────────────────────────────────────
router.get("/get-session", async (req: Request, res: ExpressResponse) => {
  try {
    const session = await getCurrentSession(buildHeaders(req));

    if (!session) {
      res.status(401).json({ success: false, error: "Usuário não autenticado." });
      return;
    }

    res.json(session);
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] get-session:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao buscar sessão." });
  }
});

// ─── POST /api/auth/login-email/send-otp ──────────────────────────────────────
router.post("/login-email/send-otp", async (req: Request, res: ExpressResponse) => {
  try {
    const emailSchema = z.string().trim().toLowerCase().superRefine((v, ctx) => {
      if (!isValidEmail(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Digite um e-mail válido." });
      else if (!isValidDomain(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas e-mails do domínio permitido são aceitos." });
    });
    const schema = z.object({ email: emailSchema, resend: z.boolean().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos.", "email"); return; }
    const { email, resend } = parsed.data;
    const ip = getRequestIp(req);
    const result = await sendLoginEmailOtp({ email, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao enviar código.")) {
      return;
    }

    res.json({ success: true, data: { cooldownSeconds: result.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] login-email/send-otp:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao enviar código." });
  }
});

// ─── POST /api/auth/login-email/verify-otp ────────────────────────────────────
router.post("/login-email/verify-otp", async (req: Request, res: ExpressResponse) => {
  try {
    const emailSchema = z.string().trim().toLowerCase().superRefine((v, ctx) => {
      if (!isValidEmail(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Digite um e-mail válido." });
      else if (!isValidDomain(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas e-mails do domínio permitido são aceitos." });
    });
    const schema = z.object({ email: emailSchema, code: z.string().trim().length(6, "Digite o código com 6 caracteres.") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, code } = parsed.data;
    const ip = getRequestIp(req);
    const result = await verifyLoginEmailOtp({ email, code, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao verificar código.")) {
      return;
    }

    appendSetCookieHeaders(res, result.setCookieHeaders);
    res.json({ success: true, data: { signedIn: true }, message: "Login realizado com sucesso!" });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] login-email/verify-otp:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao verificar código." });
  }
});

// ─── GET /api/auth/login-google ───────────────────────────────────────────────
router.get("/login-google", async (req: Request, res: ExpressResponse) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const result = await loginWithGoogle({ from, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao iniciar login com Google.")) {
      return;
    }

    if (result.response instanceof Response) {
      const response = result.response;
      for (const [key, value] of response.headers.entries()) {
        if (key.toLowerCase() !== "transfer-encoding") res.setHeader(key, value);
      }
      res.status(response.status);
      if (response.body) {
        const text = await response.text();
        res.send(text);
      } else {
        res.end();
      }
      return;
    }

    res.redirect(result.fallbackRedirect ?? "/login");
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] login-google:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao iniciar login com Google." });
  }
});

// ─── POST /api/auth/setup-password ────────────────────────────────────────────
router.post("/setup-password", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email(),
      code: z.string().trim().length(6),
      password: z.string().min(8).max(120).refine(isValidPassword, "Senha inválida."),
      autoSignIn: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, code, password, autoSignIn } = parsed.data;
    const result = await completePasswordSetup({
      email,
      code,
      password,
      autoSignIn,
      headers: buildHeaders(req),
    });

    if (respondAuthServiceError(res, result, "Erro ao definir senha.")) {
      return;
    }

    appendSetCookieHeaders(res, result.setCookieHeaders);
    res.json({ success: true, data: { signedIn: result.signedIn }, message: "Senha definida com sucesso." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] setup-password:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao definir senha." });
  }
});

// ─── POST /api/auth/sign-up/email ─────────────────────────────────────────────
router.post("/sign-up/email", async (req: Request, res: ExpressResponse) => {
  try {
    const emailSchema = z.string().trim().toLowerCase().superRefine((v, ctx) => {
      if (!isValidEmail(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Digite um e-mail válido." });
      else if (!isValidDomain(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Apenas e-mails do domínio permitido são aceitos." });
    });
    const schema = z.object({
      name: z.string().trim().min(2).max(120).superRefine((v, ctx) => { if (!isValidName(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Digite um nome válido." }); }),
      email: emailSchema,
      password: z.string().min(8, "Senha inválida.").max(120).superRefine((v, ctx) => { if (!isValidPassword(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter pelo menos 8 caracteres, com maiúsculas, minúsculas, número e caractere especial." }); }),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { name, email, password } = parsed.data;
    const ip = getRequestIp(req);
    const result = await createSignUpEmail({ name, email, password, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao criar conta.")) {
      return;
    }

    res.status(201).json({ success: true, data: { cooldownSeconds: result.cooldownSeconds }, message: "Conta criada com sucesso. Verifique seu e-mail." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] sign-up/email:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao criar conta." });
  }
});

// ─── POST /api/auth/sign-up/email/send-otp ────────────────────────────────────
router.post("/sign-up/email/send-otp", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({ email: z.string().trim().toLowerCase().email(), resend: z.boolean().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, resend } = parsed.data;
    const ip = getRequestIp(req);
    const result = await sendSignUpEmailOtp({ email, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao enviar código.")) {
      return;
    }

    res.json({ success: true, data: { cooldownSeconds: result.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] sign-up/email/send-otp:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao enviar código." });
  }
});

// ─── POST /api/auth/sign-up/email/verify-otp ──────────────────────────────────
router.post("/sign-up/email/verify-otp", async (req: Request, res: ExpressResponse) => {
  try {
    const schema = z.object({
      email: z.string().trim().toLowerCase().email(),
      code: z.string().trim().length(6),
      password: z.string().min(8).max(160).optional(),
      autoSignIn: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { respondAuthValidationError(res, parsed, "Dados inválidos."); return; }
    const { email, code, password, autoSignIn } = parsed.data;
    const ip = getRequestIp(req);
    const result = await verifySignUpEmailOtp({ email, code, password, autoSignIn, ip, headers: buildHeaders(req) });
    if (respondAuthServiceError(res, result, "Erro ao verificar código.")) {
      return;
    }

    appendSetCookieHeaders(res, result.setCookieHeaders);
    res.json({ success: true, data: { success: true, signedIn: result.signedIn }, message: "Conta verificada com sucesso." });
  } catch (err) {
    console.error("❌ [AUTH_CUSTOM] sign-up/email/verify-otp:", err);
    if (respondAuthInfrastructureError(res, err)) return;
    res.status(500).json({ success: false, error: "Erro ao verificar código." });
  }
});

export default router;
