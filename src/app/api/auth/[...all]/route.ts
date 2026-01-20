import { auth } from "@/lib/auth/server";

const handler = (request: Request): Promise<Response> => auth.handler(request);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
