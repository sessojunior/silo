import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const PROFILE = String(process.env.SILO_LOAD_PROFILE || "load").trim().toLowerCase();
export const DEFAULT_DURATION_SECONDS = PROFILE === "soak" ? 86_400 : 300;
export const DEFAULT_CONCURRENCY = PROFILE === "soak" ? 4 : 8;
export const DEFAULT_REQUEST_TIMEOUT_MS = PROFILE === "soak" ? 30_000 : 15_000;
export const DEFAULT_SLO_P95_MS = PROFILE === "soak" ? 5_000 : 2_500;
export const DEFAULT_SLO_ERROR_RATE = 0.01;

export const DEFAULT_REQUESTS = [{ name: "health", method: "GET", path: "/health", weight: 6 }];

export const AUTHENTICATED_REQUESTS = [
  { name: "dashboard-root", method: "GET", path: "/api/dashboard", weight: 8 },
  { name: "dashboard-summary", method: "GET", path: "/api/dashboard/summary", weight: 8 },
  { name: "dashboard-causes", method: "GET", path: "/api/dashboard/problems-causes", weight: 5 },
  {
    name: "dashboard-solutions",
    method: "GET",
    path: "/api/dashboard/problems-solutions",
    weight: 5,
  },
  { name: "dashboard-projects", method: "GET", path: "/api/dashboard/projects", weight: 5 },
  { name: "products", method: "GET", path: "/api/products", weight: 8 },
  { name: "projects", method: "GET", path: "/api/projects", weight: 8 },
  { name: "contacts", method: "GET", path: "/api/contacts", weight: 6 },
  { name: "groups", method: "GET", path: "/api/groups", weight: 6 },
  { name: "users-active", method: "GET", path: "/api/users?status=active", weight: 6 },
  { name: "monitoring-radars", method: "GET", path: "/api/monitoring/radars", weight: 4 },
  {
    name: "monitoring-picture-pages",
    method: "GET",
    path: "/api/monitoring/picture-pages",
    weight: 4,
  },
  { name: "reports-availability", method: "GET", path: "/api/reports/availability", weight: 5 },
  {
    name: "reports-availability-pdf",
    method: "POST",
    path: "/api/reports/availability/pdf",
    body: {},
    weight: 2,
  },
  { name: "reports-executive", method: "GET", path: "/api/reports/executive", weight: 4 },
  {
    name: "reports-executive-pdf",
    method: "POST",
    path: "/api/reports/executive/pdf",
    body: {},
    weight: 2,
  },
  { name: "reports-projects", method: "GET", path: "/api/reports/projects", weight: 4 },
  { name: "ai-assistant-examples", method: "GET", path: "/api/ai-assistant/examples", weight: 4 },
  { name: "ai-assistant-threads", method: "GET", path: "/api/ai-assistant/threads", weight: 4 },
  {
    name: "ai-assistant-stream",
    kind: "sse",
    method: "POST",
    path: "/api/ai-assistant/messages/stream",
    body: {
      content: "Benchmark fase 14: resumo operacional do SILO.",
    },
    headers: {
      accept: "text/event-stream",
      "cache-control": "no-cache",
    },
    weight: 2,
    stopAfterFirstEvent: true,
  },
  { name: "chat-sidebar", method: "GET", path: "/api/chat/sidebar", weight: 4 },
  { name: "chat-presence", method: "GET", path: "/api/chat/presence", weight: 4 },
  { name: "chat-unread", method: "GET", path: "/api/chat/unread-messages", weight: 4 },
];

export function getNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

export function normalizeBaseUrl(value) {
  const raw = String(value || "http://127.0.0.1:4000").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function hasAuthCookie() {
  return String(process.env.SILO_LOAD_AUTH_COOKIE || "").trim().length > 0;
}

export function getDefaultRequests() {
  return hasAuthCookie() ? AUTHENTICATED_REQUESTS : DEFAULT_REQUESTS;
}

export function buildRequestBody(request) {
  if (request.body === undefined || request.body === null) return undefined;
  if (typeof request.body === "string") return request.body;
  return JSON.stringify(request.body);
}

export function buildHeaders(request) {
  const headers = new Headers(request.headers || {});
  if (request.body !== undefined && request.body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (request.kind === "sse" && !headers.has("accept")) {
    headers.set("accept", "text/event-stream");
  }
  if (process.env.SILO_LOAD_AUTH_COOKIE) {
    headers.set("cookie", process.env.SILO_LOAD_AUTH_COOKIE);
  }
  return headers;
}

export function buildRequestUrl(request, baseUrl) {
  const url = new URL(request.path, baseUrl);
  if (request.query && typeof request.query === "object" && !Array.isArray(request.query)) {
    for (const [key, rawValue] of Object.entries(request.query)) {
      if (rawValue === undefined || rawValue === null) continue;
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        }
        continue;
      }
      url.searchParams.set(key, String(rawValue));
    }
  }
  return url;
}

export function expandRequests(requests) {
  const expanded = [];
  for (const request of requests) {
    const weight = Math.max(1, Number(request.weight ?? 1));
    for (let index = 0; index < weight; index += 1) {
      expanded.push(request);
    }
  }
  return expanded.length > 0 ? expanded : DEFAULT_REQUESTS;
}

export function pickRequest(requests, index) {
  return requests[index % requests.length];
}

async function readResponseBodyMetrics(response, request, startedAt) {
  if (request.kind !== "sse" || !response.body) {
    return {
      bodyText: await response.text().catch(() => ""),
      firstEventMs: null,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const stopAfterFirstEvent = request.stopAfterFirstEvent !== false;
  let bodyText = "";
  let firstEventMs = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunkText = decoder.decode(value, { stream: true });
      if (firstEventMs === null && chunkText.length > 0) {
        firstEventMs = performance.now() - startedAt;
      }
      bodyText += chunkText;
      if (stopAfterFirstEvent && bodyText.includes("\n\n")) {
        break;
      }
    }
    bodyText += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return { bodyText, firstEventMs };
}

export async function main() {
  const baseUrl = normalizeBaseUrl(process.env.SILO_LOAD_BASE_URL);
  const durationSeconds = getNumber(process.env.SILO_LOAD_DURATION_SECONDS, DEFAULT_DURATION_SECONDS);
  const concurrency = Math.max(
    1,
    Math.floor(getNumber(process.env.SILO_LOAD_CONCURRENCY, DEFAULT_CONCURRENCY)),
  );
  const requestTimeoutMs = Math.max(
    1,
    Math.floor(getNumber(process.env.SILO_LOAD_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS)),
  );
  const sloP95Ms = Math.max(1, Math.floor(getNumber(process.env.SILO_LOAD_SLO_P95_MS, DEFAULT_SLO_P95_MS)));
  const sloErrorRate = Math.min(1, Math.max(0, getNumber(process.env.SILO_LOAD_SLO_ERROR_RATE, DEFAULT_SLO_ERROR_RATE)));
  const sseSloMs = getNumber(process.env.SILO_LOAD_SSE_FIRST_EVENT_SLO_MS, Number.NaN);
  const requests = expandRequests(parseJson(process.env.SILO_LOAD_REQUESTS_JSON, getDefaultRequests()));
  const startedAt = performance.now();
  const deadline = startedAt + durationSeconds * 1000;
  const latencies = [];
  const sseLatencies = [];
  const statuses = new Map();
  let errorCount = 0;
  let requestCount = 0;

  async function runWorker(workerIndex) {
    let requestIndex = workerIndex;
    while (performance.now() < deadline) {
      const request = pickRequest(requests, requestIndex);
      requestIndex += concurrency;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error("request timeout")),
        requestTimeoutMs,
      );
      const url = buildRequestUrl(request, baseUrl);
      const started = performance.now();
      try {
        const response = await fetch(url, {
          method: request.method || "GET",
          headers: buildHeaders(request),
          body: buildRequestBody(request),
          signal: controller.signal,
        });
        const { bodyText, firstEventMs } = await readResponseBodyMetrics(response, request, started);
        if (request.expectStatus && !request.expectStatus.includes(response.status)) {
          errorCount += 1;
          statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
          continue;
        }
        const elapsedMs = performance.now() - started;
        latencies.push(elapsedMs);
        if (request.kind === "sse") {
          sseLatencies.push(firstEventMs ?? elapsedMs);
        }
        statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
        if (!response.ok && request.failOnNonOk !== false) {
          errorCount += 1;
        }
        if (bodyText && request.failOnBodyContains) {
          if (request.failOnBodyContains.some((needle) => bodyText.includes(String(needle)))) {
            errorCount += 1;
          }
        }
      } catch {
        errorCount += 1;
      } finally {
        requestCount += 1;
        clearTimeout(timeout);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => runWorker(index)));

  const elapsedMs = performance.now() - startedAt;
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  const summary = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    durationSeconds,
    concurrency,
    requestCount,
    errorCount,
    errorRate,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    sseRequestCount: sseLatencies.length,
    sseFirstEventP50Ms: percentile(sseLatencies, 0.5),
    sseFirstEventP95Ms: percentile(sseLatencies, 0.95),
    sseFirstEventP99Ms: percentile(sseLatencies, 0.99),
    elapsedMs,
    statuses: Object.fromEntries([...statuses.entries()].sort((left, right) => left[0] - right[0])),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  const hasSseSlo = Number.isFinite(sseSloMs);
  if (summary.p95Ms > sloP95Ms || errorRate > sloErrorRate || (hasSseSlo && summary.sseFirstEventP95Ms > sseSloMs)) {
    throw new Error(
      `SLO violado: p95=${summary.p95Ms.toFixed(1)}ms (limite ${sloP95Ms}ms), errorRate=${(errorRate * 100).toFixed(2)}% (limite ${(sloErrorRate * 100).toFixed(2)}%), SSE p95=${summary.sseFirstEventP95Ms.toFixed(1)}ms${hasSseSlo ? ` (limite ${sseSloMs}ms)` : ""}`,
    );
  }
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
