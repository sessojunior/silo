/**
 * api-client.ts — Cliente HTTP enxuto para chamadas server-side ao apps/api.
 *
 * Use este arquivo em Server Components e Server Actions que precisam falar com apps/api.
 * Em componentes client-side, use fetch(config.getApiUrl("/api/...")) para preservar o basePath.
 */

import { config } from "@/lib/config";
import type { ApiResponse } from "@silo/engine/contracts/api-response";

export function getApiUrl(path: string): string {
  return config.getApiUrl(path);
}

export async function apiGet<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = getApiUrl(path);
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = getApiUrl(path);
  const res = await fetch(url, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json() as Promise<ApiResponse<T>>;
}
