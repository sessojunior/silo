import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "@/lib/db";
import {
  authUser,
  authSession,
  authAccount,
  authVerification,
} from "@/lib/db/schema";
import { headers } from "next/headers";
import type { EmailTemplateData } from "@/lib/email/types";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { eq } from "drizzle-orm";
import { authApiPath, getAuthServerBaseURL } from "@/lib/auth/urls";
import { errorResponse } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/admin";
import { config } from "@/lib/config";

const extractOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const normalizeTrustedOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("*")) return trimmed.replace(/\/$/, "");
  return extractOrigin(trimmed);
};

const resolveTrustedOrigins = (): string[] => {
  const candidates = [
    process.env.APP_URL_DEV,
    process.env.APP_URL_PROD,
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  if (process.env.NODE_ENV !== "production") {
    candidates.push("http://localhost:*", "http://127.0.0.1:*");
  }

  const origins = candidates
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeTrustedOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(origins));
};

const authBaseURL = getAuthServerBaseURL();
const authBasePath = config.getPublicPath(authApiPath);

export const auth = betterAuth({
  ...(authBaseURL ? { baseURL: authBaseURL } : {}),
  basePath: authBasePath,
  trustedOrigins: resolveTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
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
        const { sendEmail } = await import("@/lib/sendEmail");

        const subject =
          type === "forget-password"
            ? "Código para redefinir sua senha"
            : type === "email-verification"
              ? "Código de verificação"
              : "Seu código de login";

        const result = await sendEmail({
          to: email,
          subject,
          text: `Seu código é ${otp}`,
          template: "otpCode",
          data: {
            code: otp,
            type: type as EmailTemplateData["otpCode"]["type"],
          },
        });

        if ("error" in result) {
          throw new Error(result.error.message || "Erro ao enviar e-mail.");
        }
      },
    }),
  ],
});

// Helper to get authenticated user in server components / API routes
export async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

type AuthGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response };

export async function requireAuthUser(): Promise<AuthGuardResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, response: errorResponse("Usuário não autenticado.", 401) };
  }
  return { ok: true, user };
}

export async function requireAdminAuthUser(): Promise<AuthGuardResult> {
  const userResult = await requireAuthUser();
  if (!userResult.ok) return userResult;

  const adminCheck = await requireAdmin(userResult.user.id);
  if (!adminCheck.success) {
    return { ok: false, response: errorResponse(adminCheck.error, 403) };
  }

  return userResult;
}
