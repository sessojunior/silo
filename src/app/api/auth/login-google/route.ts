import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { auth } from "@/lib/auth/server";
import { postLoginRedirectPath } from "@/lib/auth/urls";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const originPath = from === "register" ? "/register" : "/login";

  const errorCallbackURL = new URL(config.getPublicPath(originPath), req.url)
    .toString();

  const callbackURL = config.getPublicPath(postLoginRedirectPath);

  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL,
      errorCallbackURL,
    },
    headers: req.headers,
    asResponse: true,
  });

  if (result instanceof Response) {
    return result;
  }

  if (typeof result === "object" && result !== null && "url" in result) {
    const raw = (result as { url?: unknown }).url;
    if (typeof raw === "string" && raw.length > 0) {
      return NextResponse.redirect(new URL(raw, req.url));
    }
  }

  return NextResponse.redirect(new URL(config.getPublicPath("/login"), req.url));
}
