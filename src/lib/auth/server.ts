import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { createAuthMiddleware, APIError, getOAuthState } from 'better-auth/api';
import { db } from '@/lib/db';
import {
  authUser,
  authSession,
  authAccount,
  authVerification,
} from '@/lib/db/schema';
import { headers } from 'next/headers';
import type { EmailTemplateData } from '@/lib/email/types';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';
import { eq, and } from 'drizzle-orm';
import { authApiPath, getAuthServerBaseURL } from '@/lib/auth/urls';
import { errorResponse } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth/admin';
import { config } from '@/lib/config';
import { isValidDomain } from '@/lib/auth/validate';
import {
  getProfileImagePath,
  uploadProfileImageFromUrl,
} from '@/lib/profileImage';
import { addUserToDefaultGroup } from '@/lib/auth/user-groups';
import {
  AUTH_SESSION_DURATION_SECONDS,
  AUTH_SESSION_UPDATE_AGE_SECONDS,
} from '@/lib/auth/rate-limits';

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
  if (trimmed.includes('*')) return trimmed.replace(/\/$/, '');
  return extractOrigin(trimmed);
};

const resolveTrustedOrigins = (): string[] => {
  const candidates = [
    process.env.APP_URL_DEV,
    process.env.APP_URL_PROD,
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  if (process.env.NODE_ENV !== 'production') {
    candidates.push('http://localhost:*', 'http://127.0.0.1:*');
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
  session: {
    expiresIn: AUTH_SESSION_DURATION_SECONDS,
    updateAge: AUTH_SESSION_UPDATE_AGE_SECONDS,
  },
  account: {
    storeStateStrategy: 'cookie',
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  trustedOrigins: resolveTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: 'pg',
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
            typeof data.email === 'string'
              ? data.email.trim().toLowerCase()
              : '';
          if (email.length === 0) return;
          if (isValidDomain(email)) return;
          throw new APIError('FORBIDDEN', {
            message: 'unauthorized',
          });
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
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: (profile) => {
        const rawEmail =
          typeof (profile as { email?: unknown }).email === 'string'
            ? (profile as { email: string }).email
            : null;
        const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
        return email ? { email } : {};
      },
      ...(config.googleCallbackUrl
        ? { redirectURI: config.googleCallbackUrl }
        : {}),
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const isEmailPasswordSignIn = ctx.path === '/sign-in/email';
      const isEmailOtpSignIn = ctx.path === '/sign-in/email-otp';

      if (!isEmailPasswordSignIn && !isEmailOtpSignIn) return;
      const email = ctx.body?.email;
      if (!email) return;

      const user = await db.query.authUser.findFirst({
        where: eq(authUser.email, email),
      });

      if (user && !user.isActive) {
        throw new APIError('FORBIDDEN', {
          message: 'Usuário inativo. Contate o administrador.',
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith('/callback/')) return;

      const newSession = ctx.context.newSession;
      if (!newSession) return;

      const email = newSession.user.email.trim().toLowerCase();
      if (!isValidDomain(email)) {
        await ctx.context.internalAdapter
          .deleteSession(newSession.session.token)
          .catch(() => null);

        const cookiesToExpire = [
          ctx.context.authCookies.sessionToken,
          ctx.context.authCookies.sessionData,
          ctx.context.authCookies.dontRememberToken,
          ...(ctx.context.options.account?.storeAccountCookie
            ? [ctx.context.authCookies.accountData]
            : []),
        ];

        for (const cookie of cookiesToExpire) {
          ctx.setCookie(cookie.name, '', { ...cookie.attributes, maxAge: 0 });
        }

        const oauthState = await getOAuthState();
        const rawErrorURL =
          typeof oauthState?.errorURL === 'string' &&
          oauthState.errorURL.length > 0
            ? oauthState.errorURL
            : config.getPublicPath('/login');

        const redirectUrl = new URL(
          rawErrorURL,
          ctx.request?.url ?? config.appUrl
        );
        redirectUrl.searchParams.set('error', 'unauthorized');
        throw ctx.redirect(redirectUrl.toString());
      }

      if (ctx.path !== '/callback/google') return;

      const userId = newSession.user.id;
      const addedToDefaultGroup = await addUserToDefaultGroup(userId);
      if (!addedToDefaultGroup) {
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: 'Grupo padrão não configurado no sistema.',
        });
      }
      const existingUser = await db
        .select({ image: authUser.image })
        .from(authUser)
        .where(eq(authUser.id, userId))
        .limit(1);
      const existingImage = existingUser[0]?.image ?? null;

      if (existingImage && existingImage !== '/images/profile.png') return;

      const existingProfileImagePath = getProfileImagePath(userId);
      if (existingProfileImagePath) {
        await db
          .update(authUser)
          .set({ image: existingProfileImagePath })
          .where(eq(authUser.id, userId));
        return;
      }

      const account = await db.query.authAccount.findFirst({
        where: and(
          eq(authAccount.userId, userId),
          eq(authAccount.providerId, 'google')
        ),
      });
      const accessToken = account?.accessToken;
      if (!accessToken) return;

      const userInfoResponse = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!userInfoResponse.ok) return;

      const userInfo = (await userInfoResponse.json()) as {
        picture?: unknown;
      };
      const picture =
        typeof userInfo.picture === 'string' ? userInfo.picture.trim() : '';
      if (!picture) return;

      const uploaded = await uploadProfileImageFromUrl(picture, userId);
      if (!uploaded) return;

      const profileImagePath = getProfileImagePath(userId);
      if (!profileImagePath) return;

      await db
        .update(authUser)
        .set({ image: profileImagePath })
        .where(eq(authUser.id, userId));
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

        if (!isEmailConfigured && process.env.NODE_ENV !== 'production') {
          console.warn(
            '⚠️ [AUTH_SEND_OTP] SMTP não configurado. Usando OTP apenas no log (dev).',
            { email, type, otp }
          );
          return;
        }

        const { sendEmail } = await import('@/lib/sendEmail');

        const subject =
          type === 'forget-password'
            ? 'Código para redefinir sua senha'
            : type === 'email-verification'
              ? 'Código de verificação'
              : 'Seu código de login';

        const result = await sendEmail({
          to: email,
          subject,
          text: `Seu código é ${otp}`,
          template: 'otpCode',
          data: {
            code: otp,
            type: type as EmailTemplateData['otpCode']['type'],
          },
        });

        if ('error' in result) {
          throw new Error(result.error.message || 'Erro ao enviar e-mail.');
        }
      },
    }),
  ],
});

// Helper to get authenticated user in server components / API routes
export async function getAuthUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session?.user || null;
  } catch (error) {
    if (error instanceof APIError) {
      return null;
    }
    console.error("❌ [AUTH_SESSION] Falha ao obter sessão:", { error });
    return null;
  }
}

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;

type AuthGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response };

export async function requireAuthUser(): Promise<AuthGuardResult> {
  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      response: errorResponse('Usuário não autenticado.', 401),
    };
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
