/**
 * Instrumentação do servidor Next.js.
 *
 * Mantém o modelo de IA (Ollama) carregado em memória via warm-up periódico.
 * Roda a cada 23 horas para garantir que o modelo nunca seja descarregado
 * (OLLAMA_KEEP_ALIVE é 24h), mesmo após fins de semana ou feriados prolongados.
 */

const WARMUP_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23 horas

async function warmUpModel(): Promise<void> {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const response = await fetch(new URL("/api/warmup", apiUrl).toString(), {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        success: boolean;
        data?: { latencyMs: number };
      };
      console.log(
        `🔥 [INSTRUMENTATION] Modelo aquecido em ${data.data?.latencyMs ?? "?"}ms`,
      );
    } else {
      console.warn(
        `⚠️ [INSTRUMENTATION] Warm-up retornou ${response.status}`,
      );
    }
  } catch (error) {
    console.warn("⚠️ [INSTRUMENTATION] Falha no warm-up:", error);
  }
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Primeiro warm-up imediato ao iniciar o servidor
    void warmUpModel();

    // Warm-up periódico a cada 23 horas
    setInterval(() => {
      void warmUpModel();
    }, WARMUP_INTERVAL_MS);

    console.log("🔥 [INSTRUMENTATION] Warm-up do modelo de IA configurado.");
  }
}
