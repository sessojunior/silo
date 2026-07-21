import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isSafeMermaidDiagram } from "./assistant-mermaid";

describe("Assistant Mermaid security", () => {
  it("allows a simple deterministic flowchart", () => {
    expect(
      isSafeMermaidDiagram("flowchart LR\n  A[Início] --> B[Fim]"),
    ).toBe(true);
  });

  it.each([
    ["directive", '%%{init: {"securityLevel":"loose"}}%%\nflowchart TD\nA-->B'],
    ["html", 'flowchart TD\nA["<img src=x onerror=alert(1)>"]'],
    ["svg", 'flowchart TD\nA["<svg onload=alert(1)>"]'],
    ["click", 'flowchart TD\nA-->B\nclick A "https://example.com"'],
    ["javascript", 'flowchart TD\nA["javascript:alert(1)"]'],
  ])("blocks unsafe %s payloads", (_name, diagram) => {
    expect(isSafeMermaidDiagram(diagram)).toBe(false);
  });

  it("keeps the renderer on strict mode without definition innerHTML interpolation", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/admin/chat/assistant-mermaid.tsx"),
      "utf8",
    );

    expect(source).toContain('securityLevel: "strict"');
    expect(source).toContain("document.createElement");
    expect(source).toContain("textContent = visualization.diagram");
    expect(source).toContain("replaceChildren");
    expect(source).not.toContain("securityLevel: \"loose\"");
    expect(source).not.toContain("container.innerHTML");
  });
});
