import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-response";
import { config as appConfig } from "@/lib/config";

const SESSION_COOKIE_NAME = "silo_session";

const getApiBaseUrl = (): URL => {
  const raw = process.env.API_URL || appConfig.apiOrigin || "http://localhost:4000";
  const normalized =
    raw.length === 0 ? "http://localhost:4000/" : raw.endsWith("/") ? raw : `${raw}/`;

  try {
    return new URL(normalized);
  } catch {
    return new URL("http://localhost:4000/");
  }
};

const apiBaseUrl = getApiBaseUrl();

const rewriteToApi = (pathname: string, search: string): NextResponse =>
  NextResponse.rewrite(new URL(`${pathname}${search}`, apiBaseUrl));

/**
 * Proxy function for Next.js 16+
 * 
 * In Next.js 16, `middleware.ts` is replaced by `proxy.ts`.
 * This function handles authentication guards and API proxying.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedBasePath = appConfig.publicBasePath;
  const routePath =
    normalizedBasePath && pathname.startsWith(normalizedBasePath)
      ? pathname.slice(normalizedBasePath.length) || "/"
      : pathname;

  const loginPath = appConfig.getPublicPath("/login");
  const smokeMode = req.cookies.get("silo_smoke_mode")?.value === "1";

  const requiresSessionCookie =
    routePath === "/" ||
    routePath.startsWith("/admin") ||
    routePath.startsWith("/api/admin/") ||
    routePath.startsWith("/api/upload/");

  const sessionCookie = requiresSessionCookie ? req.cookies.get(SESSION_COOKIE_NAME)?.value?.trim() ?? null : null;

  if (routePath === "/") {
    if (!sessionCookie && !smokeMode) {
      const url = req.nextUrl.clone();
      url.pathname = loginPath;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Proteção de páginas administrativas
  if (routePath.startsWith("/admin")) {
    if (!sessionCookie && !smokeMode) {
      const url = req.nextUrl.clone();
      url.pathname = loginPath;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Proteção de APIs administrativas - verificação básica de token
  if (routePath.startsWith("/api/admin/")) {
    if (!sessionCookie) {
      return errorResponse("Usuário não autenticado.", 401);
    }

    // Upload de avatar: deixar o Route Handler encaminhar o multipart
    // (api/admin/users/profile-image/route.ts)
    if (routePath === "/api/admin/users/profile-image") {
      return NextResponse.next();
    }

    const apiPath = `/api/${routePath.slice("/api/admin/".length)}`;
    return rewriteToApi(apiPath, req.nextUrl.search);
  }

  // APIs de upload: validar sessao mas deixar o Route Handler
  // (api/upload/[kind]/route.ts) encaminhar o multipart/form-data
  // corretamente, ja que NextResponse.rewrite nao preserva o corpo
  // multipart ao reescrever para origem externa.
  if (routePath.startsWith("/api/upload/")) {
    if (!sessionCookie) {
      return errorResponse("Usuário não autenticado.", 401);
    }
    return NextResponse.next();
  }

  // Demais APIs do web devem ir direto para o backend Python
  if (routePath.startsWith("/api/")) {
    return rewriteToApi(routePath, req.nextUrl.search);
  }

  return NextResponse.next();
}

// Support both named and default exports for maximum compatibility
export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
