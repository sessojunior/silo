/**
 * Inicialização do Ollama no worker.
 *
 * Responsabilidades:
 * 1. Aguardar o servidor Ollama ficar acessível (polling em /api/tags)
 * 2. Fazer pull do modelo configurado (POST /api/pull)
 * 3. Aquecer o modelo na memória (POST /api/generate com prompt simples)
 *
 * Isso substitui o serviço ollama-init do docker-compose, centralizando
 * a lógica de inicialização no worker.
 */

import { config } from "@silo/engine/config";

const POLL_INTERVAL_MS = 2_000;
const MAX_RETRIES = 60; // 2 minutos no total

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Aguarda o servidor Ollama ficar acessível.
 */
async function waitForOllama(): Promise<void> {
  const tagsUrl = new URL("/api/tags", config.ollama.url).toString();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(tagsUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        console.log("[OLLAMA-INIT] Servidor Ollama está acessível.");
        return;
      }

      console.warn(
        `[OLLAMA-INIT] Ollama respondeu com status ${response.status} (tentativa ${attempt}/${MAX_RETRIES})`,
      );
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[OLLAMA-INIT] Aguardando Ollama ficar acessível (tentativa ${attempt}/${MAX_RETRIES})...`,
        );
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Ollama não ficou acessível após ${(MAX_RETRIES * POLL_INTERVAL_MS) / 1000}s em ${config.ollama.url}`,
  );
}

/**
 * Faz pull do modelo configurado via API REST do Ollama.
 * A resposta do /api/pull é um stream NDJSON — consumimos até o status "success".
 */
async function pullModel(): Promise<void> {
  const model = config.ollama.model;
  const pullUrl = new URL("/api/pull", config.ollama.url).toString();

  console.log(`[OLLAMA-INIT] Iniciando pull do modelo "${model}"...`);

  const response = await fetch(pullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false }),
    signal: AbortSignal.timeout(1_800_000), // até 30min para download do modelo (~2GB)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao fazer pull do modelo "${model}": ${response.status} ${errorText}`,
    );
  }

  const body = (await response.json()) as { status?: string; digest?: string };
  if (body.status === "success" || body.digest) {
    console.log(`[OLLAMA-INIT] Modelo "${model}" baixado com sucesso.`);
  } else {
    console.warn(
      `[OLLAMA-INIT] Pull do modelo "${model}": status inesperado ${JSON.stringify(body)}`,
    );
  }
}

/**
 * Aquece o modelo na memória enviando um prompt simples via /api/generate.
 * Isso garante que o modelo seja carregado na GPU/RAM antes do primeiro uso real.
 */
async function warmUpModel(): Promise<void> {
  const model = config.ollama.model;
  const generateUrl = new URL("/api/generate", config.ollama.url).toString();

  console.log(`[OLLAMA-INIT] Aquecendo modelo "${model}" na memória...`);

  const response = await fetch(generateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: ".",
      stream: false,
      options: {
        temperature: 0,
        num_predict: 1,
      },
    }),
    signal: AbortSignal.timeout(config.ollama.timeoutMs * 2),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao aquecer modelo "${model}": ${response.status} ${errorText}`,
    );
  }

  console.log(`[OLLAMA-INIT] Modelo "${model}" carregado e pronto para uso.`);
}

/**
 * Inicializa o Ollama: aguarda o servidor, faz pull e aquece o modelo.
 * Deve ser chamado antes de qualquer fluxo que dependa do Ollama.
 */
export async function initOllama(): Promise<void> {
  console.log("[OLLAMA-INIT] Inicializando conexão com Ollama...");
  console.log(`[OLLAMA-INIT] URL: ${config.ollama.url}`);
  console.log(`[OLLAMA-INIT] Modelo: ${config.ollama.model}`);

  await waitForOllama();
  await pullModel();
  await warmUpModel();

  console.log("[OLLAMA-INIT] Inicialização do Ollama concluída com sucesso.");
}
