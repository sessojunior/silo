import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-response";
import { config as appConfig } from "@/lib/config";

const getApiBaseUrl = (): URL => {
  const raw = appConfig.apiOrigin || "http://localhost:3001";
  const normalized =
    raw.length === 0 ? "http://localhost:3001/" : raw.endsWith("/") ? raw : `${raw}/`;

  try {
    return new URL(normalized);
  } catch {
    return new URL("http://localhost:3001/");
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
  
  // Dynamic import to avoid Edge Runtime issues with better-auth in some environments
  const { getSessionCookie } = await import("better-auth/cookies");

  const requiresSessionCookie =
    routePath === "/" ||
    routePath.startsWith("/admin") ||
    routePath.startsWith("/api/admin/");
    
  const sessionCookie = requiresSessionCookie ? getSessionCookie(req) : null;
  
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

    const apiPath = `/api/${routePath.slice("/api/admin/".length)}`;
    return rewriteToApi(apiPath, req.nextUrl.search);
  }

  // Demais APIs do web devem ir direto para o apps/api
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