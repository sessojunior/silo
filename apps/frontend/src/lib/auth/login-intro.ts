import { config } from "@/lib/config";

declare global {
  interface Window {
    __siloSkipLoginIntroOnce?: boolean;
  }
}

const basePath = config.publicBasePath;
const loginPath = config.getPublicPath("/login");

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (trimmed.length === 0) return "/";

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.length > 0 ? withoutTrailingSlash : "/";
}

function resolvePathname(href: string): string {
  const normalizedHref = href.trim();
  if (normalizedHref.length === 0) return "/";

  if (typeof window === "undefined") {
    return normalizePathname(normalizedHref.split(/[?#]/, 1)[0] ?? "/");
  }

  try {
    return normalizePathname(new URL(normalizedHref, window.location.origin).pathname);
  } catch {
    return normalizePathname(normalizedHref.split(/[?#]/, 1)[0] ?? "/");
  }
}

function resolveIntroPathname(href: string): string {
  const pathname = resolvePathname(href);
  if (pathname === "/login") {
    return loginPath;
  }

  if (basePath.length > 0 && pathname === `${basePath}/`) {
    return basePath;
  }

  return pathname;
}

export function isLoginIntroPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return (
    normalizedPathname === loginPath ||
    normalizedPathname === "/login" ||
    normalizedPathname === basePath ||
    normalizedPathname === "/"
  );
}

export function shouldSkipLoginIntroHref(href: string): boolean {
  return isLoginIntroPath(resolveIntroPathname(href));
}

export function markSkipLoginIntro(): void {
  if (typeof window === "undefined") return;
  window.__siloSkipLoginIntroOnce = true;
}

export function shouldShowLoginIntro(): boolean {
  if (typeof window === "undefined") return true;

  if (!window.__siloSkipLoginIntroOnce) return true;

  window.__siloSkipLoginIntroOnce = false;
  return false;
}