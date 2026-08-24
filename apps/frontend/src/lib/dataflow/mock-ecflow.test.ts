import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";

const SMNA_ECFLOW_TREE_URL =
  "https://unconglomerated-physiologically-grant.ngrok-free.dev/app9/json";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createDataFlowFetchMock() {
  const apiPathname = new URL(
    config.getApiUrl("/api/admin/products/bam/data-flow"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");

      if (requestUrl.pathname === apiPathname) {
        expect(init?.cache).toBe("no-store");
        return jsonResponse({ success: false });
      }

      throw new Error(`Unexpected request: ${requestUrl.href}`);
    },
  );

  return { fetchMock };
}

describe("mock-ecflow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa o fallback embutido sem buscar o feed SMNA no navegador", async () => {
    vi.resetModules();

    const { fetchMock } = createDataFlowFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const { loadFallbackEcflowTreeRoot, useDataFlowPipelines } =
      await import("./mock-ecflow");

    const root = await loadFallbackEcflowTreeRoot();
    expect(root).toMatchObject({
      kind: "suite",
    });

    const { result } = renderHook(() => useDataFlowPipelines("bam"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Nenhum fetch para o feed SMNA externo: os pipelines vêm da API ou do fallback.
    expect(fetchMock).not.toHaveBeenCalledWith(SMNA_ECFLOW_TREE_URL, expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(
      config.getApiUrl("/api/admin/products/bam/data-flow"),
      { cache: "no-store" },
    );
    expect(result.current.ecflowRoot).toMatchObject({
      kind: "suite",
    });
    expect(result.current.pipelines).toHaveLength(1);
    expect(result.current.pipelines[0]).toMatchObject({
      model: "bam",
      date: "2026-05-13",
      turn: "00",
      status: "completed",
    });
  });
});
