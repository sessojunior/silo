import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { errorResponse } from "@/lib/api-response";
import { config as appConfig } from "@/lib/config";
import { postLoginRedirectPath } from "@/lib/auth/urls";

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
  const homeWhenLoggedInPath = appConfig.getPublicPath(postLoginRedirectPath);

  if (routePath === "/") {
    return NextResponse.redirect(
      new URL(sessionCookie ? homeWhenLoggedInPath : loginPath, req.url),
    );
  }

  // Proteção de páginas administrativas
  if (routePath.startsWith("/admin")) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL(loginPath, req.url));
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
  matcher: ["/", "/admin/:path*", "/api/admin/:path*"],
};
