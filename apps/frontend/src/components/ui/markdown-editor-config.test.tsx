import { describe, expect, it } from "vitest";

import {
  compactMarkdownEditorOptions,
  defaultMarkdownEditorOptions,
} from "./markdown-editor-config";

describe("markdown editor configuration", () => {
  it("does not autofocus and exposes stable compact options", () => {
    expect(defaultMarkdownEditorOptions.autofocus).toBe(false);
    expect(compactMarkdownEditorOptions).toEqual({
      minHeight: "180px",
      maxHeight: "180px",
    });
  });
});
