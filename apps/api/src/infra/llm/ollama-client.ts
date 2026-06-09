import { z } from "zod";

import { config } from "@silo/engine/config";

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const OllamaChatResponseSchema = z.object({
  message: z.object({
    role: z.string(),
    content: z.string(),
  }),
  done: z.boolean().optional(),
  eval_count: z.number().int().nonnegative().optional(),
  eval_duration: z.number().int().nonnegative().optional(),
});

type ChatOptions = {
  messages: OllamaChatMessage[];
  model?: string;
  timeoutMs?: number;
  think?: boolean;
};

const DEFAULT_MODEL_CONTEXT_LENGTH = 131_072;
const modelContextLengthCache = new Map<string, Promise<number>>();
const OLLAMA_STATUS_TIMEOUT_MS = 3_000;

const queue: Array<() => void> = [];
let activeRequests = 0;

async function withConcurrencyLimit<T>(limit: number, task: () => Promise<T>): Promise<T> {
  if (activeRequests >= limit) {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
    });
  }

  activeRequests += 1;

  try {
    return await task();
  } finally {
    activeRequests -= 1;
    const next = queue.shift();
    if (next) {
      next();
    }
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOllamaModelDetails(model: string, timeoutMs: number): Promise<Response> {
  return fetchWithTimeout(
    new URL("/api/show", config.ollama.url).toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model }),
    },
    timeoutMs,
  );
}

function collectContextLengthCandidates(
  value: unknown,
  candidates: number[] = [],
  keyHint = "",
): number[] {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    keyHint.toLowerCase().includes("context_length")
  ) {
    candidates.push(value);
    return candidates;
  }

  if (!value || typeof value !== "object") {
    return candidates;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectContextLengthCandidates(item, candidates, keyHint);
    }
    return candidates;
  }

  if (!isRecord(value)) {
    return candidates;
  }

  for (const [key, candidate] of Object.entries(value)) {
    collectContextLengthCandidates(candidate, candidates, key);
  }

  return candidates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractModelContextLength(value: unknown): number | null {
  const candidates = collectContextLengthCandidates(value);
  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

async function resolveModelContextLength(
  model: string,
  timeoutMs: number,
): Promise<number> {
  const cached = modelContextLengthCache.get(model);
  if (cached) {
    return cached;
  }

  const resolved = (async () => {
    try {
      const response = await requestOllamaModelDetails(model, Math.min(timeoutMs, 10_000));

      if (!response.ok) {
        return DEFAULT_MODEL_CONTEXT_LENGTH;
      }

      const rawBody = (await response.json()) as unknown;
      return extractModelContextLength(rawBody) ?? DEFAULT_MODEL_CONTEXT_LENGTH;
    } catch {
      return DEFAULT_MODEL_CONTEXT_LENGTH;
    }
  })();

  modelContextLengthCache.set(model, resolved);
  return resolved;
}

export type OllamaRuntimeProbeResult = {
  model: string;
  isReachable: boolean;
  latencyMs: number;
  errorMessage: string | null;
};

export async function probeOllamaRuntime({
  model = config.ollama.model,
  timeoutMs = Math.min(config.ollama.timeoutMs, OLLAMA_STATUS_TIMEOUT_MS),
}: {
  model?: string;
  timeoutMs?: number;
} = {}): Promise<OllamaRuntimeProbeResult> {
  const startedAt = Date.now();

  try {
    const response = await requestOllamaModelDetails(model, timeoutMs);
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        model,
        isReachable: false,
        latencyMs,
        errorMessage: `Falha no Ollama (${response.status} ${response.statusText}): ${errorText}`,
      };
    }

    await response.json();

    return {
      model,
      isReachable: true,
      latencyMs,
      errorMessage: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      model,
      isReachable: false,
      latencyMs,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function chatWithOllama({
  messages,
  model = config.ollama.model,
  timeoutMs = config.ollama.timeoutMs,
  think = true,
}: ChatOptions): Promise<{
  content: string;
  latencyMs: number;
  generatedTokens: number | null;
  thinkingTimeMs: number | null;
}> {
  return withConcurrencyLimit(config.ollama.maxConcurrentRequests, async () => {
    const resolvedContextLength = await resolveModelContextLength(model, timeoutMs);
    const startedAt = Date.now();

    const buildChatBody = (useThink: boolean) =>
      JSON.stringify({
        model,
        messages,
        think: useThink,
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
          top_p: 0.9,
          num_predict: 2048,
          num_ctx: resolvedContextLength,
        },
      });

    let response: Response;
    try {
      response = await fetchWithTimeout(
        new URL("/api/chat", config.ollama.url).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: buildChatBody(think),
        },
        timeoutMs,
      );

      // Se o modelo não suportar thinking, tenta sem
      if (!response.ok && think) {
        const errorText = await response.text();
        if (errorText.toLowerCase().includes("thinking")) {
          response = await fetchWithTimeout(
            new URL("/api/chat", config.ollama.url).toString(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: buildChatBody(false),
            },
            timeoutMs,
          );
        }
      }
    } catch {
      // Se falhar por timeout/abort com think, retry sem
      if (think) {
        response = await fetchWithTimeout(
          new URL("/api/chat", config.ollama.url).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: buildChatBody(false),
          },
          timeoutMs,
        );
      } else {
        throw new Error("Falha ao conectar com o Ollama.");
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Falha no Ollama (${response.status}): ${errorText}`,
      );
    }

    const rawBody = (await response.json()) as unknown;
    const parsedBody = OllamaChatResponseSchema.parse(rawBody);
    return {
      content: parsedBody.message.content,
      latencyMs,
      generatedTokens: parsedBody.eval_count ?? null,
      thinkingTimeMs:
        typeof parsedBody.eval_duration === "number"
          ? Math.max(0, Math.round(parsedBody.eval_duration / 1_000_000))
          : null,
    };
  });
}

type OllamaStreamChunk = {
  token: string;
  done: boolean;
};

/**
 * Versão streaming do chatWithOllama — retorna tokens conforme são gerados.
 * Usa stream: true no Ollama e faz yield de cada chunk via AsyncGenerator.
 */
export async function* chatWithOllamaStream({
  messages,
  model = config.ollama.model,
  timeoutMs = config.ollama.timeoutMs,
}: ChatOptions): AsyncGenerator<OllamaStreamChunk> {
  const resolvedContextLength = await resolveModelContextLength(model, timeoutMs);

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.2,
      top_p: 0.9,
      num_predict: 2048,
      num_ctx: resolvedContextLength,
    },
  });

  const response = await fetchWithTimeout(
    new URL("/api/chat", config.ollama.url).toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
    timeoutMs,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha no Ollama (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error("Ollama retornou resposta sem corpo.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;

        try {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };

          if (parsed.message?.content) {
            yield { token: parsed.message.content, done: false };
          }

          if (parsed.done) {
            yield { token: "", done: true };
            return;
          }
        } catch {
          // Ignora linhas malformadas no stream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Se chegou aqui sem done explícito, emite done
  yield { token: "", done: true };
}