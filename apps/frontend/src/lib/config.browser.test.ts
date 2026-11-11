// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";

import { config, isChatRealtimeOriginCompatible } from "./config";

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

it("allows chat realtime on another port when protocol and host are the same", () => {
  expect(
    isChatRealtimeOriginCompatible("http://localhost:4000", "http://localhost"),
  ).toBe(true);
  expect(
    isChatRealtimeOriginCompatible("https://localhost:4000", "http://localhost"),
  ).toBe(false);
  expect(
    isChatRealtimeOriginCompatible("http://api:4000", "http://localhost"),
  ).toBe(false);
});
