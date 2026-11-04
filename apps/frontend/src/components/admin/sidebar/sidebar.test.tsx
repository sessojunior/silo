import { describe, expect, it } from "vitest";

import { shouldShowAiAssistant } from "./sidebar";

describe("shouldShowAiAssistant", () => {
  it("requires both the user preference and the reports permission", () => {
    expect(shouldShowAiAssistant(true, true)).toBe(true);
    expect(shouldShowAiAssistant(false, true)).toBe(false);
    expect(shouldShowAiAssistant(true, false)).toBe(false);
  });
});
