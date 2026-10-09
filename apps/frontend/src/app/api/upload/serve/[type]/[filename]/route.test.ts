import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuthUser } from "@/lib/auth/server";
import { config } from "@/lib/config";

import { GET } from "./route";

vi.mock("@/lib/auth/server", () => ({
  requireAuthUser: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    getApiUrl: vi.fn(),
  },
}));

const pdfBytes = new TextEncoder().encode("%PDF-1.7 persisted fixture%\\n%%EOF");

describe("GET /api/upload/serve/:type/:filename", () => {
  beforeEach(() => {
    vi.mocked(requireAuthUser).mockResolvedValue({
      ok: true,
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.test",
        emailVerified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(config.getApiUrl).mockReturnValue(
      "http://backend.test/api/upload/serve/reports/executive.pdf",
    );
  });

  it("serves the authenticated persisted PDF with signature, size and SHA-256", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(pdfBytes, {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      ),
    );

    const response = await GET(
      new Request("http://frontend.test/api/upload/serve/reports/executive.pdf", {
        headers: { cookie: "silo_session=session-1" },
      }),
      { params: Promise.resolve({ type: "reports", filename: "executive.pdf" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(pdfBytes.byteLength));
    expect(response.headers.get("x-content-sha256")).toBe(
      "5a774d286b4697c51627739259a05062f2ec1e7a89559e1dc53513961410d31f",
    );
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(pdfBytes));
  });

  it("rejects traversal and non-PDF filenames before contacting storage", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const traversal = await GET(
      new Request("http://frontend.test/api/upload/serve/reports/%2e%2e%2fsecret.pdf"),
      { params: Promise.resolve({ type: "reports", filename: "../secret.pdf" }) },
    );
    const nonPdf = await GET(
      new Request("http://frontend.test/api/upload/serve/reports/report.txt"),
      { params: Promise.resolve({ type: "reports", filename: "report.txt" }) },
    );

    expect(traversal.status).toBe(404);
    expect(nonPdf.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an authenticated session", async () => {
    vi.mocked(requireAuthUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Usuário não autenticado." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://frontend.test/api/upload/serve/reports/executive.pdf"),
      { params: Promise.resolve({ type: "reports", filename: "executive.pdf" }) },
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
