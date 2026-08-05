import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("rewrites browser API requests through the backend proxy boundary", async () => {
  vi.stubEnv("API_URL", "http://api:4000");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/silo");

  const { NextRequest } = await import("next/server");
  const { proxy } = await import("./proxy");

  const request = new NextRequest("http://localhost/silo/api/admin/users?status=active", {
    headers: {
      cookie: "silo_session=fixture-token",
    },
  });

  const response = await proxy(request);

  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "http://api:4000/api/users?status=active",
  );
});

it("keeps public API paths same-origin while passing them to the backend", async () => {
  vi.stubEnv("API_URL", "http://api:4000");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/silo");

  const { NextRequest } = await import("next/server");
  const { proxy } = await import("./proxy");

  const request = new NextRequest("http://localhost/silo/api/server-time");
  const response = await proxy(request);

  expect(response.headers.get("x-middleware-rewrite")).toBe(
    "http://api:4000/api/server-time",
  );
});

it("blocks admin API routes without a session cookie", async () => {
  vi.stubEnv("API_URL", "http://api:4000");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/silo");

  const { NextRequest } = await import("next/server");
  const { proxy } = await import("./proxy");

  const request = new NextRequest("http://localhost/silo/api/admin/users");
  const response = await proxy(request);
  const body = await response.json();

  expect(response.status).toBe(401);
  expect(body).toMatchObject({
    success: false,
  });
});
