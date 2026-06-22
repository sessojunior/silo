/**
 * Cliente HTTP para geração de embeddings via Ollama.
 *
 * Usa o modelo nomic-embed-text:v1.5 (~137M params, 768 dimensões)
 * que executa em ~100ms em CPU — rápido o suficiente para ser chamado
 * no caminho crítico da requisição.
 */
import { config } from "@silo/engine/config";

const EMBEDDING_CACHE = new Map<string, number[]>();
const EMBEDDING_CACHE_MAX_SIZE = 256;

/**
 * Gera um embedding (vetor de 768 floats) para o texto informado.
 * Resultados são cacheados em memória para textos idênticos (ex.: escopos).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const key = text.trim();
  if (key.length === 0) {
    return new Array<number>(768).fill(0);
  }

  const cached = EMBEDDING_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const url = new URL("/api/embeddings", config.ollama.url).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.ollama.embeddingModel, prompt: key }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao gerar embedding (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as { embedding: number[] };

  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error("Ollama retornou embedding vazio.");
  }

  // Limpa cache se estourou o limite
  if (EMBEDDING_CACHE.size >= EMBEDDING_CACHE_MAX_SIZE) {
    const oldestKey = EMBEDDING_CACHE.keys().next().value;
    if (oldestKey) {
      EMBEDDING_CACHE.delete(oldestKey);
    }
  }

  EMBEDDING_CACHE.set(key, data.embedding);
  return data.embedding;
}

/**
 * Calcula similaridade de cosseno entre dois vetores.
 * Usado como fallback para cálculos em memória (classificação de escopo).
 * Para buscas no banco, prefira o operador <=> do pgvector.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dot / magnitude;
}

/**
 * Converte array de números para literal SQL vector do pgvector.
 * Ex.: [0.1, 0.2, 0.3] → "ARRAY[0.1::float8,0.2::float8,0.3::float8]::vector"
 */
export function toVectorLiteral(embedding: number[]): string {
  const values = embedding.map((v) => `${v}::float8`).join(",");
  return `ARRAY[${values}]::vector`;
}
