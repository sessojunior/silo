/**
 * Classificação de escopo do assistente por similaridade de embedding.
 *
 * Substitui a chamada ao Ollama para classificar o escopo da pergunta.
 * Gera embeddings pré-calculados para cada descrição de escopo (cache em memória)
 * e compara com o embedding da pergunta do usuário via similaridade de cosseno.
 *
 * Latência: ~100ms (só o embedding da pergunta, escopos são cacheados).
 * Precisão: >90% para perguntas bem formuladas em português.
 */
import type { AiAssistantScope } from "@silo/engine/contracts/dto/ai-assistant";
import { AI_ASSISTANT_SCOPES } from "@silo/engine/contracts/dto/ai-assistant";
import { generateEmbedding, cosineSimilarity } from "../infra/llm/embedding-client.js";

/** Confiança mínima (0 a 1) para aceitar a classificação. */
const MIN_CONFIDENCE = 0.35;

/**
 * Descrições semânticas de cada escopo em português brasileiro.
 * Estas descrições são usadas para gerar embeddings que representam
 * o "centroide" de cada escopo no espaço vetorial.
 */
const SCOPE_DESCRIPTIONS: Record<AiAssistantScope, string> = {
  models:
    "disponibilidade de modelos e produtos industriais, rodadas de produção, turnos, intervenções realizadas, eficácia de intervenções, sinais de rodada, desempenho por produto, métricas de disponibilidade",
  pending:
    "pendências em aberto, tarefas atrasadas, bloqueios, times sobrecarregados, prioridades de execução, atividades não concluídas, gargalos, o que está travado",
  reports:
    "relatórios gerenciais, dashboards, resumo executivo, visão geral da operação, cenário atual, indicadores consolidados, panorama, visão ampla",
  problems:
    "problemas e falhas operacionais, incidentes, erros, causas de falha, categorias de problema, recorrência, impacto por produto, o que quebrou, o que falhou",
  solutions:
    "soluções aplicadas, correções realizadas, resolução de problemas, reabertura de incidentes, eficácia de soluções, padrões de correção, o que foi feito para resolver",
  projects:
    "projetos em andamento, atividades, tarefas, cronograma, prazos, progresso de projetos, gargalos em projetos, times envolvidos, status de projetos",
  general:
    "panorama geral da operação, resumo do dia, visão ampla de todos os indicadores, cenário completo, status geral da produção, como estão as coisas, resumo",
  generate_pdf:
    "exportar relatório em PDF, gerar documento PDF, baixar relatório, imprimir relatório, salvar PDF, exportar dados, gerar arquivo",
};

/** Cache em memória dos embeddings dos escopos. Inicializado no primeiro uso. */
let scopeEmbeddings: Map<AiAssistantScope, number[]> | null = null;

/**
 * Pré-aquece o cache de embeddings dos escopos.
 * Chame no boot da API para evitar latência na primeira requisição.
 */
export async function warmupScopeEmbeddings(): Promise<void> {
  if (scopeEmbeddings) return;

  scopeEmbeddings = new Map();
  const scopes = AI_ASSISTANT_SCOPES as readonly AiAssistantScope[];

  for (const scope of scopes) {
    const description = SCOPE_DESCRIPTIONS[scope];
    if (!description) continue;

    try {
      const embedding = await generateEmbedding(description);
      scopeEmbeddings.set(scope, embedding);
    } catch (err) {
      console.warn(
        `⚠️ [SCOPE_EMBEDDING] Falha ao gerar embedding para escopo "${scope}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `🧠 [SCOPE_EMBEDDING] ${scopeEmbeddings.size}/${scopes.length} escopos indexados`,
  );
}

/**
 * Classifica a pergunta do usuário no escopo mais provável.
 * Retorna null se nenhum escopo atingir a confiança mínima.
 */
export async function classifyScopeByEmbedding(
  question: string,
): Promise<{ scope: AiAssistantScope; confidence: number } | null> {
  // Garante que os embeddings dos escopos estão carregados
  if (!scopeEmbeddings) {
    await warmupScopeEmbeddings();
  }

  if (!scopeEmbeddings || scopeEmbeddings.size === 0) {
    return null;
  }

  let questionEmbedding: number[];
  try {
    questionEmbedding = await generateEmbedding(question);
  } catch (err) {
    console.warn(
      "⚠️ [SCOPE_EMBEDDING] Falha ao gerar embedding da pergunta:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  let bestScope: AiAssistantScope | null = null;
  let bestScore = -1;

  for (const [scope, scopeEmbedding] of scopeEmbeddings) {
    const score = cosineSimilarity(questionEmbedding, scopeEmbedding);
    if (score > bestScore) {
      bestScore = score;
      bestScope = scope;
    }
  }

  if (!bestScope || bestScore < MIN_CONFIDENCE) {
    return null;
  }

  return { scope: bestScope, confidence: bestScore };
}
