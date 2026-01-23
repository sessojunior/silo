import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { errorResponse } from "@/lib/api-response";
import { config as appConfig } from "@/lib/config";

// Proteção de rotas privadas
// Redireciona páginas /admin/* sem sessão para login
// APIs /api/admin/* fazem verificação básica de token no proxy + verificação completa nas próprias APIs

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const normalizedBasePath = appConfig.publicBasePath;
  const routePath =
    normalizedBasePath && pathname.startsWith(normalizedBasePath)
      ? pathname.slice(normalizedBasePath.length) || "/"
      : pathname;

  const sessionCookie = getSessionCookie(req);
  const loginPath = appConfig.getPublicPath("/login");
  if (routePath === "/") {
    if (!sessionCookie) {
      const url = req.nextUrl.clone();
      url.pathname = loginPath;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Proteção de páginas administrativas
  if (routePath.startsWith("/admin")) {
    if (!sessionCookie) {
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

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
