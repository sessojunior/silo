import type { NextRequest } from "next/server";

import proxyImpl from "./src/proxy";

export async function proxy(req: NextRequest) {
	return proxyImpl(req);
}

export default proxy;

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
	],
};

