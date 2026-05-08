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
});

type ChatOptions = {
  messages: OllamaChatMessage[];
  model?: string;
  timeoutMs?: number;
};

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

export async function chatWithOllama({
  messages,
  model = config.ollama.model,
  timeoutMs = config.ollama.timeoutMs,
}: ChatOptions): Promise<{
  content: string;
  latencyMs: number;
}> {
  return withConcurrencyLimit(config.ollama.maxConcurrentRequests, async () => {
    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      new URL("/api/chat", config.ollama.url).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: "json",
          options: {
            temperature: 0.2,
            top_p: 0.9,
            num_predict: 512,
          },
        }),
      },
      timeoutMs,
    );

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Falha no Ollama (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    const rawBody = (await response.json()) as unknown;
    const parsedBody = OllamaChatResponseSchema.parse(rawBody);
    return {
      content: parsedBody.message.content,
      latencyMs,
    };
  });
}