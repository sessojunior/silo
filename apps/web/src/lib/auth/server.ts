import { headers } from "next/headers";
import { errorResponse } from "@/lib/api-response";
import { config } from "@/lib/config";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
  lastLogin?: string | null;
};

type AuthGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: Response };

const getAuthApiUrl = (path: string): string => {
  if (config.apiOrigin) {
    return new URL(path, config.apiOrigin).toString();
  }

  return config.getApiUrl(path);
};

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const reqHeaders = await headers();
    const res = await fetch(getAuthApiUrl("/api/auth/get-session"), {
      headers: { cookie: reqHeaders.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { user?: AuthUser };
    return data?.user ?? null;
  } catch {
    return null;
  }
}

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

  try {
    const reqHeaders = await headers();
    const res = await fetch(getAuthApiUrl("/api/check-admin"), {
      headers: {
        cookie: reqHeaders.get("cookie") ?? "",
        "content-type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, response: errorResponse("Acesso negado.", 403) };
    }
    const data = await res.json() as { data?: { isAdmin?: boolean } };
    if (!data?.data?.isAdmin) {
      return { ok: false, response: errorResponse("Acesso negado.", 403) };
    }
  } catch {
    return { ok: false, response: errorResponse("Erro ao verificar permissões.", 500) };
  }

  return userResult;
}

// Mantido por compatibilidade - redireciona para login usando config
export const authRedirectPath = config.getPublicPath("/login");
