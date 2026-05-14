import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "@silo/database";
import {
  authUser,
  authSession,
  authAccount,
  authVerification,
} from "@silo/database/schema";
import { hashPassword, verifyPassword } from "@silo/engine/auth/hash";
import { config } from "@silo/engine/config";
import { eq } from "drizzle-orm";

const AUTH_SESSION_DURATION_DAYS = 365;
const AUTH_SESSION_DURATION_SECONDS = AUTH_SESSION_DURATION_DAYS * 24 * 60 * 60;
const AUTH_SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

const authApiPath = "/api/auth";
const postLoginRedirectPath = "/admin/dashboard";

export const isValidDomain = (email: string): boolean => {
  const allowedDomains = config.allowedEmailDomains;
  if (allowedDomains.length === 0) return true;
  const domain = email.split("@")[1] ?? "";
  return allowedDomains.includes(domain);
};

const isGoogleAuthEnabled =
  config.googleClientId.length > 0 && config.googleClientSecret.length > 0;

export const auth = betterAuth({
  baseURL: config.betterAuthBaseUrl,
  basePath: authApiPath,
  session: {
    expiresIn: AUTH_SESSION_DURATION_SECONDS,
    updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
    cookieCache: {
      enabled: true,
      maxAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
    },
  },
  account: {
    storeStateStrategy: "cookie",
    accountLinking: {
      enabled: isGoogleAuthEnabled,
      trustedProviders: isGoogleAuthEnabled ? ["google"] : [],
    },
  },
  trustedOrigins: config.betterAuthTrustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          const email =
            typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
          if (email.length === 0) return;
          if (isValidDomain(email)) return;
          throw new APIError("FORBIDDEN", { message: "unauthorized" });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const isEmailPasswordSignIn = ctx.path === "/sign-in/email";
      const isEmailOtpSignIn = ctx.path === "/sign-in/email-otp";
      if (!isEmailPasswordSignIn && !isEmailOtpSignIn) return;
      const email = ctx.body?.email;
      if (!email) return;
      const user = await db.query.authUser.findFirst({
        where: eq(authUser.email, email),
      });
      if (user && !user.isActive) {
        throw new APIError("FORBIDDEN", {
          message: "Usuário inativo. Contate o administrador.",
        });
      }
    }),
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const isEmailConfigured =
          Boolean(config.email.host) &&
          Boolean(config.email.username) &&
          Boolean(config.email.password) &&
          Boolean(config.email.from);

        if (!isEmailConfigured && config.nodeEnv !== "production") {
          console.warn("⚠️ [AUTH_SEND_OTP] SMTP não configurado. OTP apenas no log:", {
            email,
            type,
            otp,
          });
          return;
        }

        const { sendEmailTemplate } = await import("@silo/engine/email/send-email-template");
        const subject =
          type === "forget-password"
            ? "Código para redefinir sua senha"
            : type === "email-verification"
              ? "Código de verificação"
              : "Seu código de login";

        await sendEmailTemplate({
          to: email,
          subject,
          template: "otpCode",
          data: {
            code: otp,
            type: type as "sign-in" | "forget-password" | "email-verification" | "email-change",
          },
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
export type AuthUser = Auth["$Infer"]["Session"]["user"];

export { postLoginRedirectPath };
