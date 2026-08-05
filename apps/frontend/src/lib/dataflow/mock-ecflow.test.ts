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

  const smnaPayload = {
    kind: "suite",
    name: "SMNA_PRE_OPER",
    date: "2026-05-13",
    turn: "PRE_OPER",
    node_state: "queued",
    groups: [
      {
        kind: "family",
        name: "00",
        id: "SMNA_00_2026-05-13",
        date: "2026-05-13",
        turn: "00",
        node_state: "complete",
        tasks: [
          {
            kind: "task",
            id: "download_gfs_025",
            name: "Download GFS 0.25",
            state: "complete",
            plannedStartAt: "2026-05-13T00:00:00Z",
            plannedEndAt: "2026-05-13T00:30:00Z",
            startedAt: "2026-05-13T00:00:00Z",
            finishedAt: "2026-05-13T00:30:00Z",
            referenceDurationMinutes: 30,
          },
        ],
      },
    ],
  };

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");

      if (requestUrl.pathname === apiPathname) {
        expect(init?.cache).toBe("no-store");
        return jsonResponse({ success: false });
      }

      if (requestUrl.href === SMNA_ECFLOW_TREE_URL) {
        expect(init).toMatchObject({
          cache: "no-store",
          credentials: "omit",
        });
        return jsonResponse(smnaPayload);
      }

      throw new Error(`Unexpected request: ${requestUrl.href}`);
    },
  );

  return { fetchMock, smnaPayload };
}

describe("mock-ecflow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the shared SMNA feed and reuses it for the requested slug", async () => {
    vi.resetModules();

    const { fetchMock, smnaPayload } = createDataFlowFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const {
      loadFallbackEcflowTreeRoot,
      useDataFlowPipelines,
      SMNA_ECFLOW_TREE_URL: importedUrl,
    } = await import("./mock-ecflow");

    const root = await loadFallbackEcflowTreeRoot();
    expect(importedUrl).toBe(SMNA_ECFLOW_TREE_URL);
    expect(root).toMatchObject({
      kind: "suite",
      name: smnaPayload.name,
      date: smnaPayload.date,
      turn: smnaPayload.turn,
    });

    const { result } = renderHook(() => useDataFlowPipelines("bam"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(SMNA_ECFLOW_TREE_URL, {
      cache: "no-store",
      credentials: "omit",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      config.getApiUrl("/api/admin/products/bam/data-flow"),
      { cache: "no-store" },
    );
    expect(result.current.ecflowRoot).toMatchObject({
      kind: "suite",
      name: "SMNA_PRE_OPER",
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
