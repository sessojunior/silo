import { describe, expect, it } from "vitest";

import {
  ASSISTANT_MEDIA_CSP_DIRECTIVES,
  getSafeAssistantImageSource,
  getSafeAssistantPdfFrameSource,
  isSafeSvgDataUri,
} from "./assistant-media-safety";

const svgDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

describe("assistant media safety", () => {
  it("allows only normalized local upload image URLs with allowed prefixes", () => {
    expect(getSafeAssistantImageSource("/uploads/avatars/user.webp")).toBe(
      "/uploads/avatars/user.webp",
    );
    expect(getSafeAssistantImageSource("/uploads/problems/item.png")).toBe(
      "/uploads/problems/item.png",
    );

    expect(getSafeAssistantImageSource("//evil.test/x.png")).toBeNull();
    expect(getSafeAssistantImageSource("https://evil.test/x.png")).toBeNull();
    expect(getSafeAssistantImageSource("/uploads/avatars/../secret.png")).toBeNull();
    expect(getSafeAssistantImageSource("/uploads/avatars/%2e%2e/secret.png")).toBeNull();
    expect(getSafeAssistantImageSource("/uploads/avatars\\secret.png")).toBeNull();
    expect(getSafeAssistantImageSource("/not-uploads/user.webp")).toBeNull();
    expect(getSafeAssistantImageSource("/uploads/avatars/user.exe")).toBeNull();
  });

  it("allows PDF frame sources only from report serve prefixes and .pdf files", () => {
    expect(
      getSafeAssistantPdfFrameSource("/api/upload/serve/reports/executive.pdf"),
    ).toBe("/api/upload/serve/reports/executive.pdf");
    expect(
      getSafeAssistantPdfFrameSource("/uploads/serve/reports/executive.pdf"),
    ).toBe("/api/upload/serve/reports/executive.pdf");

    expect(getSafeAssistantPdfFrameSource("/uploads/reports/executive.pdf")).toBeNull();
    expect(getSafeAssistantPdfFrameSource("/api/upload/serve/avatars/a.pdf")).toBeNull();
    expect(getSafeAssistantPdfFrameSource("/api/upload/serve/reports/a.txt")).toBeNull();
    expect(getSafeAssistantPdfFrameSource("//evil.test/report.pdf")).toBeNull();
  });

  it("allows exact image data URI MIME types and blocks generic or active content", () => {
    const safeSvg = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg"><text>ok</text></svg>');
    expect(isSafeSvgDataUri(safeSvg)).toBe(true);
    expect(getSafeAssistantImageSource(safeSvg)).toBe(safeSvg);
    expect(getSafeAssistantImageSource("data:image/png;base64,aGVsbG8=")).toBe(
      "data:image/png;base64,aGVsbG8=",
    );

    expect(getSafeAssistantImageSource("data:image/gif;base64,aGVsbG8=")).toBeNull();
    expect(getSafeAssistantImageSource("data:image/*;base64,aGVsbG8=")).toBeNull();
    expect(getSafeAssistantImageSource("data:text/html;base64,PGgxPmE8L2gxPg==")).toBeNull();
    expect(getSafeAssistantImageSource(svgDataUri("<svg><script>alert(1)</script></svg>"))).toBeNull();
    expect(getSafeAssistantImageSource(svgDataUri('<svg><rect onclick="alert(1)" /></svg>'))).toBeNull();
    expect(getSafeAssistantImageSource(svgDataUri("<svg><foreignObject /></svg>"))).toBeNull();
    expect(getSafeAssistantImageSource(svgDataUri('<svg><image href="https://evil.test/x.png" /></svg>'))).toBeNull();
  });

  it("keeps CSP directives constrained for image and frame rendering", () => {
    expect(ASSISTANT_MEDIA_CSP_DIRECTIVES.imgSrc).toEqual(["'self'", "data:"]);
    expect(ASSISTANT_MEDIA_CSP_DIRECTIVES.frameSrc).toEqual(["'self'"]);
    expect(ASSISTANT_MEDIA_CSP_DIRECTIVES.imgSrc).not.toContain("*");
    expect(ASSISTANT_MEDIA_CSP_DIRECTIVES.frameSrc).not.toContain("data:");
    expect(ASSISTANT_MEDIA_CSP_DIRECTIVES.frameSrc).not.toContain("https:");
  });
});
