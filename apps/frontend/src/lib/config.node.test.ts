// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config server-side URL resolution", () => {
  it("uses the internal API origin when available", () => {
    vi.stubEnv("API_URL", "http://api:4000");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/silo");

    expect(config.publicBasePath).toBe("/silo");
    expect(config.getPublicPath("/admin/dashboard")).toBe("/silo/admin/dashboard");
    expect(config.getApiUrl("/api/admin/users")).toBe("http://api:4000/api/admin/users");
    expect(config.getAssistantApiUrl("/api/admin/ai-assistant/messages/stream")).toBe(
      "http://api:4000/api/ai-assistant/messages/stream",
    );
  });

  it("supports an empty public base path without injecting /silo", () => {
    vi.stubEnv("API_URL", "http://api:4000");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    expect(config.publicBasePath).toBe("");
    expect(config.getPublicPath("/admin/dashboard")).toBe("/admin/dashboard");
    expect(config.getPublicPath("admin/dashboard")).toBe("/admin/dashboard");
  });
});
