// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";

import { config } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("keeps browser API calls inside the public base path", () => {
  vi.stubEnv("API_URL", "http://api:4000");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/silo");

  expect(config.getApiUrl("/api/admin/users")).toBe("/silo/api/admin/users");
  expect(config.getAssistantApiUrl("/api/admin/ai-assistant/messages/stream")).toBe(
    "/silo/api/ai-assistant/messages/stream",
  );
});
