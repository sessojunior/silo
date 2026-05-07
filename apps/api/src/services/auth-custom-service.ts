import { db, isDatabaseInfrastructureUnavailable } from "@silo/database";
import { authAccount, authUser, authVerification, group, userGroup } from "@silo/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hashPassword } from "@silo/engine/auth/hash";
import { config } from "@silo/engine/config";
import { auth } from "../auth/setup.js";
import { clearRateLimitForEmail, getRateLimitStatus, recordRateLimit } from "../infra/rate-limit-db.js";

const OTP_MAX_ATTEMPTS = 5;
const AUTH_OTP_RESEND_COOLDOWN_SECONDS = 90;
const AUTH_OTP_LOCKOUT_SECONDS = 15 * 60;
const AUTH_INVALID_EMAIL_MAX_ATTEMPTS = 10;
const AUTH_INVALID_EMAIL_WINDOW_SECONDS = 10 * 60;
const AUTH_INVALID_CREDENTIALS_MAX_ATTEMPTS = 5;
const AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS = 15 * 60;
const FORGET_PASSWORD_COOLDOWN_SECONDS = 90;
const FORGET_PASSWORD_BURST_LIMIT = 1;
const FORGET_PASSWORD_BURST_WINDOW_SECONDS = 90;
const SIGN_UP_COOLDOWN_SECONDS = 90;
const SIGN_UP_BURST_LIMIT = 8;
const SIGN_UP_BURST_WINDOW_SECONDS = 10 * 60;

const getBetterAuthErrorCode = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

const isOtpInvalidOrExpired = (error: unknown): boolean => {
  const code = getBetterAuthErrorCode(error);
  return code === "INVALID_OTP" || code === "EXPIRED_OTP" || code === "OTP_EXPIRED";
};

const isOtpTooManyAttempts = (error: unknown): boolean =>
  getBetterAuthErrorCode(error) === "TOO_MANY_ATTEMPTS";

const parseAttempts = (value: string | null | undefined): number => {
  const parsed = Number(value);
  return !value || !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.floor(parsed);
};

const readSetCookieHeaders = (headers: Headers): string[] => {
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
};

export async function loginWithGoogle(params: {
  from?: string;
  headers: Record<string, string>;
}) {
  const { from, headers } = params;

  if (!config.googleClientId || !config.googleClientSecret) {
    return { error: "Login com Google indisponível neste ambiente.", status: 503 };
  }

  const appUrl = (config.appUrl || "http://localhost:3000/silo").replace(/\/$/, "");
  const originPath = from === "register" ? "/register" : "/login";
  const errorCallbackURL = `${appUrl}${originPath}`;
  const callbackURL = `${appUrl}/admin/dashboard`;

  const result = await auth.api.signInSocial({ body: { provider: "google", callbackURL, errorCallbackURL }, headers, asResponse: true });
  return { ok: true, response: result, fallbackRedirect: `${appUrl}/login` };
}

export async function getCurrentSession(headers: Record<string, string>) {
  return auth.api.getSession({ headers });
}

const normalizeErrorKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
};

export async function createSignUpEmail(params: {
  name: string;
  email: string;
  password: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { name, email, password, ip, headers } = params;

  const cooldown = await getRateLimitStatus({
    email,
    ip,
    route: "sign-up-email-cooldown",
    limit: 1,
    windowInSeconds: SIGN_UP_COOLDOWN_SECONDS,
  });
  if (cooldown.isLimited) {
    return { error: "Aguarde para tentar novamente.", status: 429, retryAfterSeconds: cooldown.retryAfterSeconds };
  }

  const burst = await getRateLimitStatus({
    email,
    ip,
    route: "sign-up-email-burst",
    limit: SIGN_UP_BURST_LIMIT,
    windowInSeconds: SIGN_UP_BURST_WINDOW_SECONDS,
  });
  if (burst.isLimited) {
    return { error: "Muitas tentativas. Aguarde.", status: 429, retryAfterSeconds: burst.retryAfterSeconds };
  }

  const response = await auth.api.signUpEmail({ body: { name, email, password }, headers, asResponse: true });
  if (!response.ok) {
    let payload: { code?: string; message?: string } | null = null;
    try {
      payload = await response.clone().json() as { code?: string; message?: string } | null;
    } catch {}

    const code = normalizeErrorKey(payload?.code);
    const messageCode = normalizeErrorKey(payload?.message);
    if (response.status === 409 || code === "USER_ALREADY_EXISTS" || messageCode === "USER_ALREADY_EXISTS") {
      return { error: "Este e-mail já está em uso. Use outro e-mail.", field: "email", status: 400 };
    }
    if (response.status >= 500) {
      return { error: "Serviço de autenticação temporariamente indisponível.", status: 503 };
    }
    return { error: payload?.message ?? "Erro ao criar conta.", status: response.status };
  }

  await auth.api.sendVerificationOTP({ body: { email, type: "email-verification" }, headers });
  await db.delete(authVerification).where(eq(authVerification.identifier, `sign-up-email-verification:attempts:${email}`));
  await recordRateLimit({ email, ip, route: "sign-up-email-cooldown", windowInSeconds: SIGN_UP_COOLDOWN_SECONDS });
  await recordRateLimit({ email, ip, route: "sign-up-email-burst", windowInSeconds: SIGN_UP_BURST_WINDOW_SECONDS });

  return { ok: true, cooldownSeconds: SIGN_UP_COOLDOWN_SECONDS };
}

export async function sendForgetPasswordOtp(params: {
  email: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, ip, headers } = params;

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) {
    const st = await getRateLimitStatus({
      email: "unknown",
      ip,
      route: "forget-password-wrong-email",
      limit: AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    if (st.isLimited) {
      return { error: "Aguarde para tentar novamente.", field: "email", status: 429, retryAfterSeconds: st.retryAfterSeconds };
    }
    await recordRateLimit({
      email: "unknown",
      ip,
      route: "forget-password-wrong-email",
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    return { error: "E-mail inexistente.", field: "email", status: 404 };
  }

  const cooldown = await getRateLimitStatus({
    email,
    ip,
    route: "forget-password-send-otp-cooldown",
    limit: FORGET_PASSWORD_BURST_LIMIT,
    windowInSeconds: FORGET_PASSWORD_COOLDOWN_SECONDS,
  });
  if (cooldown.isLimited) {
    return { error: "Aguarde para reenviar o código.", status: 429, retryAfterSeconds: cooldown.retryAfterSeconds };
  }

  const attemptsId = `forget-password:attempts:${email}`;
  await db.delete(authVerification).where(eq(authVerification.identifier, attemptsId));
  await auth.api.sendVerificationOTP({ body: { email, type: "forget-password" }, headers });
  await recordRateLimit({ email, ip, route: "forget-password-send-otp-cooldown", windowInSeconds: FORGET_PASSWORD_COOLDOWN_SECONDS });

  return { ok: true, email, cooldownSeconds: FORGET_PASSWORD_COOLDOWN_SECONDS };
}

export async function verifyForgetPasswordOtp(params: {
  email: string;
  code: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, code, ip, headers } = params;
  const LOCKOUT_ROUTE = "forget-password-verify-otp-lockout";

  const lockout = await getRateLimitStatus({ email, ip, route: LOCKOUT_ROUTE, limit: 1, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
  if (lockout.isLimited) {
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: lockout.retryAfterSeconds };
  }

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) return { error: "E-mail inexistente.", field: "email", status: 404 };

  const attemptsId = `forget-password:attempts:${email}`;
  const attemptsRow = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
  const now = new Date();

  if (!attemptsRow || attemptsRow.expiresAt < now) {
    if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
  } else if (parseAttempts(attemptsRow.value) >= OTP_MAX_ATTEMPTS) {
    await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
  }

  let verified = false;
  try {
    const result = await auth.api.checkVerificationOTP({ body: { email, otp: code, type: "forget-password" }, headers });
    verified = result?.success === true;
  } catch (err) {
    if (isOtpTooManyAttempts(err)) {
      await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
      return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
    }
    if (!isOtpInvalidOrExpired(err)) throw err;
  }

  if (!verified) {
    const row2 = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
    const expiresAt = row2?.expiresAt && row2.expiresAt > now ? row2.expiresAt : new Date(now.getTime() + 10 * 60 * 1000);
    const next = parseAttempts(row2?.value) + 1;
    if (row2) {
      await db.update(authVerification).set({ value: String(next), expiresAt, updatedAt: now }).where(eq(authVerification.id, row2.id));
    } else {
      await db.insert(authVerification).values({ id: randomUUID(), identifier: attemptsId, value: String(next), expiresAt, createdAt: now, updatedAt: now });
    }
    if (next >= OTP_MAX_ATTEMPTS) {
      await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
      return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
    }
    return { error: "Código inválido ou expirado.", field: "code", status: 400 };
  }

  if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
  else await db.delete(authVerification).where(eq(authVerification.identifier, attemptsId));
  await clearRateLimitForEmail({ email });
  return { ok: true };
}

export async function sendSignUpEmailOtp(params: {
  email: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, ip, headers } = params;

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) {
    const st = await getRateLimitStatus({
      email: "unknown",
      ip,
      route: "sign-up-email-verification-wrong-email",
      limit: AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    if (st.isLimited) {
      return { error: "Aguarde para tentar novamente.", field: "email", status: 429, retryAfterSeconds: st.retryAfterSeconds };
    }
    await recordRateLimit({
      email: "unknown",
      ip,
      route: "sign-up-email-verification-wrong-email",
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    return { error: "E-mail inexistente.", field: "email", status: 404 };
  }

  const cooldown = await getRateLimitStatus({
    email,
    ip,
    route: "sign-up-email-verification-send-otp-cooldown",
    limit: 1,
    windowInSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  });
  if (cooldown.isLimited) {
    return { error: "Aguarde para reenviar o código.", status: 429, retryAfterSeconds: cooldown.retryAfterSeconds };
  }

  await db.delete(authVerification).where(eq(authVerification.identifier, `sign-up-email-verification:attempts:${email}`));
  await auth.api.sendVerificationOTP({ body: { email, type: "email-verification" }, headers });
  await recordRateLimit({ email, ip, route: "sign-up-email-verification-send-otp-cooldown", windowInSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS });

  return { ok: true, cooldownSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS };
}

export async function verifySignUpEmailOtp(params: {
  email: string;
  code: string;
  password?: string;
  autoSignIn?: boolean;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, code, password, autoSignIn, ip, headers } = params;
  const LOCKOUT_ROUTE = "sign-up-email-verification-verify-otp-lockout";

  const lockout = await getRateLimitStatus({ email, ip, route: LOCKOUT_ROUTE, limit: 1, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
  if (lockout.isLimited) {
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: lockout.retryAfterSeconds };
  }

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) return { error: "E-mail inexistente.", field: "email", status: 404 };

  const attemptsId = `sign-up-email-verification:attempts:${email}`;
  const attemptsRow = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
  const now = new Date();

  if (!attemptsRow || attemptsRow.expiresAt < now) {
    if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
  } else if (parseAttempts(attemptsRow.value) >= OTP_MAX_ATTEMPTS) {
    await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
  }

  let verified = false;
  try {
    const result = await auth.api.checkVerificationOTP({ body: { email, otp: code, type: "email-verification" }, headers });
    verified = result?.success === true;
  } catch (err) {
    if (isOtpTooManyAttempts(err)) {
      await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
      return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
    }
    if (!isOtpInvalidOrExpired(err)) throw err;
  }

  if (!verified) {
    const row2 = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
    const expiresAt = row2?.expiresAt && row2.expiresAt > now ? row2.expiresAt : new Date(now.getTime() + 10 * 60 * 1000);
    const next = parseAttempts(row2?.value) + 1;
    if (row2) await db.update(authVerification).set({ value: String(next), expiresAt, updatedAt: now }).where(eq(authVerification.id, row2.id));
    else await db.insert(authVerification).values({ id: randomUUID(), identifier: attemptsId, value: String(next), expiresAt, createdAt: now, updatedAt: now });
    if (next >= OTP_MAX_ATTEMPTS) {
      await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
      return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
    }
    return { error: "Código inválido ou expirado.", field: "code", status: 400 };
  }

  if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
  else await db.delete(authVerification).where(eq(authVerification.identifier, attemptsId));

  if (!user.emailVerified) {
    await db.update(authUser).set({ emailVerified: true, isActive: true, updatedAt: new Date() }).where(eq(authUser.id, user.id));
    const defaultGroup = await db.query.group.findFirst({ where: eq(group.isDefault, true), orderBy: [desc(group.updatedAt)] });
    if (!defaultGroup) return { error: "Grupo padrão não configurado no sistema.", status: 500 };
    const existingUg = await db.query.userGroup.findFirst({ where: eq(userGroup.userId, user.id) });
    if (!existingUg) await db.insert(userGroup).values({ id: randomUUID(), userId: user.id, groupId: defaultGroup.id, joinedAt: new Date() });
  }

  const responseCookies: string[] = [];
  let signedIn = false;

  if (autoSignIn === true && typeof password === "string") {
    const signInResp = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
    if (!signInResp.ok) {
      let payload: { message?: string } | null = null;
      try { payload = await signInResp.clone().json() as { message?: string } | null; } catch {}
      if (signInResp.status >= 500) {
        return { error: "Serviço de autenticação temporariamente indisponível.", status: 503 };
      }
      return { error: payload?.message ?? "Erro ao entrar.", status: signInResp.status };
    }

    responseCookies.push(...readSetCookieHeaders(signInResp.headers));
    signedIn = true;
  }

  await clearRateLimitForEmail({ email });
  return { ok: true, signedIn, setCookieHeaders: responseCookies };
}

export async function sendLoginEmailOtp(params: {
  email: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, ip, headers } = params;

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) {
    const st = await getRateLimitStatus({
      email: "unknown",
      ip,
      route: "login-email-wrong-email",
      limit: AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    if (st.isLimited) {
      return { error: "Aguarde para tentar novamente.", field: "email", status: 429, retryAfterSeconds: st.retryAfterSeconds };
    }
    await recordRateLimit({
      email: "unknown",
      ip,
      route: "login-email-wrong-email",
      windowInSeconds: AUTH_INVALID_EMAIL_WINDOW_SECONDS,
    });
    return { error: "E-mail inexistente.", field: "email", status: 404 };
  }

  const cooldown = await getRateLimitStatus({
    email,
    ip,
    route: "login-email-send-otp-cooldown",
    limit: 1,
    windowInSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS,
  });
  if (cooldown.isLimited) {
    return { error: "Aguarde para reenviar o código.", status: 429, retryAfterSeconds: cooldown.retryAfterSeconds };
  }

  await db.delete(authVerification).where(eq(authVerification.identifier, `login-email:attempts:${email}`));
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers });
  await recordRateLimit({ email, ip, route: "login-email-send-otp-cooldown", windowInSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS });

  return { ok: true, cooldownSeconds: AUTH_OTP_RESEND_COOLDOWN_SECONDS };
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, password, ip, headers } = params;

  const rate = await getRateLimitStatus({
    email,
    ip,
    route: "login-password",
    limit: AUTH_INVALID_CREDENTIALS_MAX_ATTEMPTS,
    windowInSeconds: AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS,
  });
  if (rate.isLimited) {
    return { error: "Aguarde para tentar novamente.", field: "email", status: 429, retryAfterSeconds: rate.retryAfterSeconds };
  }

  let response: globalThis.Response;
  try {
    response = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
  } catch (signInErr) {
    if (typeof signInErr === "object" && signInErr !== null && isDatabaseInfrastructureUnavailable(signInErr)) {
      return { error: "Serviço de autenticação temporariamente indisponível.", status: 503 };
    }
    throw signInErr;
  }

  if (!response.ok) {
    let payload: { code?: string; message?: string } | null = null;
    try {
      payload = await response.clone().json() as { code?: string; message?: string } | null;
    } catch {}

    const code = normalizeErrorKey(payload?.code);
    const messageCode = normalizeErrorKey(payload?.message);
    const isWrong = response.status === 401 || code === "INVALID_EMAIL_OR_PASSWORD" || messageCode === "INVALID_EMAIL_OR_PASSWORD";
    if (isWrong) {
      await recordRateLimit({ email, ip, route: "login-password", windowInSeconds: AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS });
      const after = await getRateLimitStatus({ email, ip, route: "login-password", limit: AUTH_INVALID_CREDENTIALS_MAX_ATTEMPTS, windowInSeconds: AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS });
      if (after.isLimited) {
        return { error: "Aguarde para tentar novamente.", field: "email", status: 429, retryAfterSeconds: after.retryAfterSeconds };
      }
      return { error: "E-mail ou senha inválidos.", field: "password", status: 401 };
    }

    if (response.status >= 500) {
      return { error: "Serviço de autenticação temporariamente indisponível.", status: 503 };
    }
    return { error: payload?.message ?? "Erro ao entrar.", status: response.status };
  }

  await clearRateLimitForEmail({ email });
  return { ok: true, signedIn: true, setCookieHeaders: readSetCookieHeaders(response.headers) };
}

export async function verifyLoginEmailOtp(params: {
  email: string;
  code: string;
  ip: string;
  headers: Record<string, string>;
}) {
  const { email, code, ip, headers } = params;
  const LOCKOUT_ROUTE = "login-email-verify-otp-lockout";

  const lockout = await getRateLimitStatus({
    email,
    ip,
    route: LOCKOUT_ROUTE,
    limit: 1,
    windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS,
  });
  if (lockout.isLimited) {
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: lockout.retryAfterSeconds };
  }

  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) return { error: "E-mail inexistente.", field: "email", status: 404 };

  const attemptsId = `login-email:attempts:${email}`;
  const attemptsRow = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
  const now = new Date();

  if (!attemptsRow || attemptsRow.expiresAt < now) {
    if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
  } else if (parseAttempts(attemptsRow.value) >= OTP_MAX_ATTEMPTS) {
    await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
  }

  let signInRes: globalThis.Response | null = null;
  let internalType: "invalid_otp" | "too_many" | null = null;
  try {
    const r = await auth.api.signInEmailOTP({ body: { email, otp: code }, headers, asResponse: true });
    if (r.ok) signInRes = r;
    else {
      let payload: { code?: string; message?: string } | null = null;
      try {
        payload = await r.clone().json() as { code?: string; message?: string } | null;
      } catch {}
      const c = getBetterAuthErrorCode(payload?.code);
      const m = getBetterAuthErrorCode(payload?.message);
      if (c === "TOO_MANY_ATTEMPTS" || m === "TOO_MANY_ATTEMPTS") internalType = "too_many";
      else if (c === "INVALID_OTP" || c === "OTP_EXPIRED" || c === "EXPIRED_OTP" || m === "INVALID_OTP") internalType = "invalid_otp";
      else {
        const s = r.status >= 500 ? 503 : r.status;
        const e = r.status >= 500 ? "Serviço de autenticação temporariamente indisponível." : (payload?.message ?? "Erro ao entrar.");
        return { error: e, field: "code", status: s };
      }
    }
  } catch (err) {
    if (isOtpTooManyAttempts(err)) internalType = "too_many";
    else if (isOtpInvalidOrExpired(err)) internalType = "invalid_otp";
    else throw err;
  }

  if (internalType === "too_many") {
    await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
  }

  if (signInRes) {
    if (attemptsRow) await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
    else await db.delete(authVerification).where(eq(authVerification.identifier, attemptsId));
    await clearRateLimitForEmail({ email });
    return { ok: true, signedIn: true, setCookieHeaders: readSetCookieHeaders(signInRes.headers) };
  }

  const row2 = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
  const expiresAt = row2?.expiresAt && row2.expiresAt > now ? row2.expiresAt : new Date(now.getTime() + 10 * 60 * 1000);
  const next = parseAttempts(row2?.value) + 1;
  if (row2) await db.update(authVerification).set({ value: String(next), expiresAt, updatedAt: now }).where(eq(authVerification.id, row2.id));
  else await db.insert(authVerification).values({ id: randomUUID(), identifier: attemptsId, value: String(next), expiresAt, createdAt: now, updatedAt: now });

  if (next >= OTP_MAX_ATTEMPTS) {
    await recordRateLimit({ email, ip, route: LOCKOUT_ROUTE, windowInSeconds: AUTH_OTP_LOCKOUT_SECONDS });
    return { error: "Aguarde para reenviar o código.", field: "code", status: 429, retryAfterSeconds: AUTH_OTP_LOCKOUT_SECONDS };
  }

  return { error: "Código inválido ou expirado.", field: "code", status: 400 };
}

export async function completePasswordSetup(params: {
  email: string;
  code: string;
  password: string;
  autoSignIn?: boolean;
  headers: Record<string, string>;
}) {
  const { email, code, password, autoSignIn, headers } = params;
  const attemptsId = `forget-password:attempts:${email}`;
  const now = new Date();

  const attemptsRow = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
  if (attemptsRow) {
    if (attemptsRow.expiresAt < now) {
      await db.delete(authVerification).where(eq(authVerification.id, attemptsRow.id));
    } else if (parseAttempts(attemptsRow.value) >= OTP_MAX_ATTEMPTS) {
      return { error: "Excesso tentativas inválidas. Comece novamente.", field: "code", status: 429, resetFlow: true as const };
    }
  }

  let verified = false;
  try {
    const result = await auth.api.checkVerificationOTP({ body: { email, otp: code, type: "forget-password" }, headers });
    verified = result?.success === true;
  } catch (err) {
    if (isOtpTooManyAttempts(err)) {
      return { error: "Excesso tentativas inválidas. Comece novamente.", field: "code", status: 429, resetFlow: true as const };
    }
    if (!isOtpInvalidOrExpired(err)) throw err;
  }

  if (!verified) {
    const row2 = await db.query.authVerification.findFirst({ where: eq(authVerification.identifier, attemptsId) });
    const expiresAt = row2?.expiresAt && row2.expiresAt > now ? row2.expiresAt : new Date(now.getTime() + 10 * 60 * 1000);
    const next = parseAttempts(row2?.value) + 1;
    if (row2) {
      await db.update(authVerification).set({ value: String(next), expiresAt, updatedAt: now }).where(eq(authVerification.id, row2.id));
    } else {
      await db.insert(authVerification).values({ id: randomUUID(), identifier: attemptsId, value: String(next), expiresAt, createdAt: now, updatedAt: now });
    }
    if (next >= OTP_MAX_ATTEMPTS) {
      return { error: "Excesso tentativas inválidas. Comece novamente.", field: "code", status: 429, resetFlow: true as const };
    }
    return { error: "Código inválido ou expirado.", field: "code", status: 400 };
  }

  await db.delete(authVerification).where(eq(authVerification.identifier, attemptsId));
  const user = await db.query.authUser.findFirst({ where: eq(authUser.email, email) });
  if (!user) return { error: "Usuário não encontrado.", status: 404 };

  const hashedPwd = await hashPassword(password);
  const account = await db.query.authAccount.findFirst({ where: and(eq(authAccount.userId, user.id), eq(authAccount.providerId, "credential")) });
  if (account) {
    await db.update(authAccount).set({ password: hashedPwd }).where(eq(authAccount.id, account.id));
  } else {
    await db.insert(authAccount).values({ id: randomUUID(), userId: user.id, accountId: email, providerId: "credential", password: hashedPwd, createdAt: new Date(), updatedAt: new Date() });
  }

  if (!user.emailVerified) {
    await db.update(authUser).set({ emailVerified: true, isActive: true, updatedAt: new Date() }).where(eq(authUser.id, user.id));
    const defaultGroup = await db.query.group.findFirst({ where: eq(group.isDefault, true), orderBy: [desc(group.updatedAt)] });
    if (!defaultGroup) return { error: "Grupo padrão não configurado no sistema.", status: 500 };
    const existingUg = await db.query.userGroup.findFirst({ where: eq(userGroup.userId, user.id) });
    if (!existingUg) await db.insert(userGroup).values({ id: randomUUID(), userId: user.id, groupId: defaultGroup.id, joinedAt: new Date() });
  }

  const responseCookies: string[] = [];
  let signedIn = false;

  if (autoSignIn === true) {
    const signInResp = await auth.api.signInEmail({ body: { email, password }, headers, asResponse: true });
    if (!signInResp.ok) {
      let payload: { message?: string } | null = null;
      try {
        payload = await signInResp.clone().json() as { message?: string } | null;
      } catch {}

      if (signInResp.status >= 500) {
        return { error: "Serviço de autenticação temporariamente indisponível.", status: 503 };
      }
      return { error: payload?.message ?? "Erro ao entrar.", status: signInResp.status };
    }

    responseCookies.push(...readSetCookieHeaders(signInResp.headers));
    signedIn = true;
  }

  await clearRateLimitForEmail({ email });
  return { ok: true, signedIn, setCookieHeaders: responseCookies };
}