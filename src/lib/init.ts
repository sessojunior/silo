/**
 * Inicialização da aplicação
 * Executa validações e configurações que devem rodar apenas em runtime
 */

import { config, configValidation } from "@/lib/config";

// Flag para evitar execução múltipla
let initialized = false;

export function initializeApp(): void {
  if (initialized) return;

  // Validar configuração apenas em produção e runtime
  if (config.nodeEnv === "production") {
    try {
      const result = configValidation.validateProductionConfig();
      void result;
    } catch (error) {
      console.error("❌ [INIT] Erro na validação de configuração:", error);
      throw error;
    }
  }

  initialized = true;
}

export function isProductionBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
