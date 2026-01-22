import { auth } from "@/lib/auth/server";
import { config } from "@/lib/config";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const withPublicBasePath = (req: NextRequest): Request => {
  const basePath = config.publicBasePath;
  if (basePath.length === 0) return req;

  const pathname = req.nextUrl.pathname;
  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) return req;

  const url = new URL(req.url);
  url.pathname = `${basePath}${pathname}`;
  url.search = req.nextUrl.search;
  return new Request(url, req);
};

export async function GET(req: NextRequest): Promise<Response> {
  return auth.handler(withPublicBasePath(req));
}

export async function POST(req: NextRequest): Promise<Response> {
  return auth.handler(withPublicBasePath(req));
}
