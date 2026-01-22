import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { auth } from "@/lib/auth/server";
import { postLoginRedirectPath } from "@/lib/auth/urls";

export const runtime = "nodejs";

const splitSetCookieHeaderValue = (value: string): string[] => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return [];

  const parts: string[] = [];
  const lower = trimmed.toLowerCase();

  let start = 0;
  let inExpires = false;

  for (let i = 0; i < trimmed.length; i++) {
    if (!inExpires && lower.slice(i, i + 8) === "expires=") {
      inExpires = true;
      continue;
    }

    const char = trimmed[i];
    if (inExpires && char === ";") {
      inExpires = false;
      continue;
    }

    if (!inExpires && char === ",") {
      const current = trimmed.slice(start, i).trim();
      if (current.length > 0) parts.push(current);
      start = i + 1;
    }
  }

  const last = trimmed.slice(start).trim();
  if (last.length > 0) parts.push(last);
  return parts;
};

const readSetCookieHeaders = (headers: Headers): string[] => {
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();

  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return splitSetCookieHeaderValue(raw);
};

export async function GET(req: NextRequest) {
  const callbackURL = config.getPublicPath(postLoginRedirectPath);

  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL },
    headers: req.headers,
    asResponse: true,
  });

  if (result instanceof Response) {
    const location =
      result.headers.get("location") ?? result.headers.get("Location");

    if (!location) return result;

    const redirectResponse = NextResponse.redirect(
      new URL(location, req.url),
      302,
    );
    for (const cookie of readSetCookieHeaders(result.headers)) {
      redirectResponse.headers.append("set-cookie", cookie);
    }
    return redirectResponse;
  }

  if (typeof result === "object" && result !== null && "url" in result) {
    const raw = (result as { url?: unknown }).url;
    if (typeof raw === "string" && raw.length > 0) {
      return NextResponse.redirect(new URL(raw, req.url));
    }
  }

  return NextResponse.redirect(new URL(config.getPublicPath("/login"), req.url));
}
