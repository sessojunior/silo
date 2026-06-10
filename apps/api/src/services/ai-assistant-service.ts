import { randomUUID } from "node:crypto";

import {
  AiAssistantCitationDto,
  AiAssistantExampleDto,
  AiAssistantExamplesResponseDto,
  AiAssistantGenerationDto,
  AiAssistantRuntimeStatusDto,
  AiAssistantMessageRequestDto,
  AiAssistantMessageResponseDto,
  AiAssistantScope,
  AiAssistantVisualizationDto,
} from "@silo/engine/contracts/dto/ai-assistant";
import { config } from "@silo/engine/config";
import { getDaysAgo } from "@silo/engine/date";
import {
  getAvailabilityReport,
  getExecutiveReport,
  getProblemsReport,
  getProjectsReport,
} from "./report-service.js";
import { generatePdf } from "./pdf-report-generator.js";
import {
  getDashboardProblemsCauses,
  getDashboardProblemsSolutions,
  getDashboardSummary,
} from "./dashboard-service.js";
import {
  classifyAssistantScopeWithOllama,
  composeAssistantAnswerWithOllama,
} from "./ai-assistant-llm-service.js";
import {
  probeOllamaRuntime,
  type OllamaChatMessage,
} from "../infra/llm/ollama-client.js";

const DEFAULT_GUIDANCE =
  "Pergunte sobre modelos, problemas, causas, intervenções, eficácia, pendências, tarefas, projetos, prioridades, relatórios e monitoramento do Silo.";

const DEFAULT_SCOPE_POLICY =
  "Se a pergunta for analítica, comparativa ou de priorização dentro do Silo, responda com diagnóstico objetivo, comparação temporal e recomendação de ação.";

const DEFAULT_EXAMPLES: AiAssistantExampleDto[] = [
  {
    id: "models",
    title: "Modelos e rodadas",
    prompt: "Quais modelos estão com menor disponibilidade nos últimos 30 dias?",
    description: "Usa disponibilidade, intervenções e sinais de rodada.",
    scope: "models",
  },
  {
    id: "model-issues",
    title: "Problemas por modelo",
    prompt: "Qual modelo está acumulando mais problemas nesta semana?",
    description: "Cruza problemas, disponibilidade e impacto recente.",
    scope: "problems",
  },
  {
    id: "pending",
    title: "Pendências",
    prompt: "Quais pendências estão mais críticas agora?",
    description: "Mostra projetos, tarefas e avanço do trabalho.",
    scope: "pending",
  },
  {
    id: "effectiveness",
    title: "Eficácia de intervenção",
    prompt: "A intervenção realizada no modelo foi eficaz e eficiente?",
    description: "Compara período atual com o anterior e indica tendência.",
    scope: "models",
  },
  {
    id: "reports",
    title: "Relatórios",
    prompt: "O que eu preciso olhar primeiro para entender o cenário de hoje?",
    description: "Resume os painéis que trazem visão rápida da operação.",
    scope: "reports",
  },
  {
    id: "problems",
    title: "Problemas",
    prompt: "Quais categorias de problema mais cresceram na última semana?",
    description: "Cruza incidências, categorias e tendência.",
    scope: "problems",
  },
  {
    id: "solutions",
    title: "Soluções",
    prompt: "Quais soluções parecem mais recorrentes para essas falhas?",
    description: "Aponta padrões de correção e recorrência.",
    scope: "solutions",
  },
  {
    id: "projects",
    title: "Projetos",
    prompt: "Quais projetos estão mais atrasados e com mais tarefas abertas?",
    description: "Foca em progresso, pendências e times impactados.",
    scope: "projects",
  },
];

const PROJECT_KEYWORDS = [
  "silo",
  "modelo",
  "modelos",
  "rodada",
  "rodadas",
  "turno",
  "turnos",
  "pendencia",
  "pendencias",
  "relatorio",
  "relatorios",
  "problema",
  "problemas",
  "solucao",
  "solucoes",
  "projeto",
  "projetos",
  "atividade",
  "atividades",
  "monitoramento",
  "dashboard",
  "execucao",
  "execucoes",
  "incidente",
  "incidentes",
  "causa",
  "causas",
  "causando",
  "motivo",
  "motivos",
  "origem",
  "origens",
  "razao",
  "razoes",
  "resolver",
  "corrigir",
  "solucionar",
  "intervencao",
  "intervencoes",
  "eficaz",
  "eficiente",
  "eficiencia",
  "impacto",
  "impactos",
  "prioridade",
  "prioridades",
  "acelerar",
  "aceleracao",
  "concretizar",
  "andamento",
  "em andamento",
  "melhorar",
  "melhoria",
  "piorar",
  "piora",
  "revisar",
  "cenario",
  "cenarios",
  "sumario",
  "sumario executivo",
  "visao geral",
];

type ScopeKeywordDefinition = {
  keyword: string;
  weight: number;
};

type ScopeMatchScore = {
  scope: AiAssistantScope;
  score: number;
  hits: number;
};

type AssistantConversationContext = {
  historyMessages: OllamaChatMessage[];
  conversationMemory: string | null;
  lastKnownScope: AiAssistantScope | null;
};

type AssistantMessageRequest = AiAssistantMessageRequestDto &
  Partial<AssistantConversationContext>;

const SCOPE_PRIORITY: AiAssistantScope[] = [
  "models",
  "pending",
  "reports",
  "problems",
  "solutions",
  "projects",
];

const SCOPE_KEYWORDS: Record<AiAssistantScope, ScopeKeywordDefinition[]> = {
  general: [],
  models: [
    { keyword: "modelo", weight: 3 },
    { keyword: "modelos", weight: 3 },
    { keyword: "rodada", weight: 2.5 },
    { keyword: "rodadas", weight: 2.5 },
    { keyword: "turno", weight: 2.5 },
    { keyword: "turnos", weight: 2.5 },
    { keyword: "disponibilidade", weight: 1.8 },
    { keyword: "intervencao", weight: 1.6 },
    { keyword: "intervencoes", weight: 1.6 },
  ],
  pending: [
    { keyword: "pendencia", weight: 3 },
    { keyword: "pendencias", weight: 3 },
    { keyword: "pendente", weight: 3 },
    { keyword: "pendentes", weight: 3 },
    { keyword: "atraso", weight: 2.5 },
    { keyword: "atrasados", weight: 2.5 },
    { keyword: "tarefas", weight: 2.2 },
    { keyword: "trava", weight: 2 },
    { keyword: "bloqueio", weight: 2 },
  ],
  reports: [
    { keyword: "relatorio", weight: 3 },
    { keyword: "relatorios", weight: 3 },
    { keyword: "dashboard", weight: 3 },
    { keyword: "cenario", weight: 1.8 },
    { keyword: "cenarios", weight: 1.8 },
    { keyword: "sumario executivo", weight: 2.5 },
    { keyword: "resumo executivo", weight: 2.5 },
    { keyword: "visao geral", weight: 2.5 },
  ],
  problems: [
    { keyword: "problema", weight: 3 },
    { keyword: "problemas", weight: 3 },
    { keyword: "falha", weight: 2.2 },
    { keyword: "falhas", weight: 2.2 },
    { keyword: "incidente", weight: 2.5 },
    { keyword: "incidentes", weight: 2.5 },
    { keyword: "erro", weight: 2 },
    { keyword: "erros", weight: 2 },
  ],
  solutions: [
    { keyword: "solucao", weight: 3 },
    { keyword: "solucoes", weight: 3 },
    { keyword: "resolver", weight: 2.5 },
    { keyword: "resolucao", weight: 2.5 },
    { keyword: "reabertura", weight: 2 },
    { keyword: "correcao", weight: 2 },
    { keyword: "recorrente", weight: 1.5 },
    { keyword: "recorrentes", weight: 1.5 },
    { keyword: "impacto", weight: 1.3 },
    { keyword: "impactos", weight: 1.3 },
    { keyword: "tendencia", weight: 1.3 },
    { keyword: "tendencias", weight: 1.3 },
  ],
  projects: [
    { keyword: "projeto", weight: 3 },
    { keyword: "projetos", weight: 3 },
    { keyword: "atividade", weight: 2.5 },
    { keyword: "atividades", weight: 2.5 },
    { keyword: "task", weight: 2 },
    { keyword: "tasks", weight: 2 },
    { keyword: "andamento", weight: 1.8 },
    { keyword: "prazo", weight: 2 },
    { keyword: "prazos", weight: 2 },
    { keyword: "cronograma", weight: 2 },
  ],
  generate_pdf: [
    { keyword: "exportar pdf", weight: 3 },
    { keyword: "gerar pdf", weight: 3 },
    { keyword: "baixar relatorio", weight: 3 },
    { keyword: "download relatorio", weight: 3 },
    { keyword: "salvar relatorio", weight: 3 },
    { keyword: "pdf", weight: 2.5 },
    { keyword: "exportar relatorio", weight: 2.5 },
    { keyword: "arquivo pdf", weight: 2.5 },
    { keyword: "imprimir relatorio", weight: 2 },
  ],
};

const DEFAULT_FOLLOW_UPS = [
  "Quais modelos mais críticos devo acompanhar hoje?",
  "Quais pendências merecem prioridade nesta semana?",
  "Quais relatórios explicam melhor o cenário atual?",
  "Quais problemas e soluções estão se repetindo?",
];

const DEFAULT_ASSISTANT_WINDOW_DAYS = 30;
const DASHBOARD_CONTEXT_WINDOW_DAYS = 28;
const SHORT_WINDOW_DAYS = 7;
const MID_WINDOW_DAYS = 15;
const LONG_WINDOW_DAYS = 90;

type AssistantDateRange = {
  dateRange: { start: string; end: string };
  label: string;
  fromDaysAgo: number;
  toDaysAgo: number;
  spanDays: number;
};

function createAssistantDateRange(
  fromDaysAgo: number,
  toDaysAgo: number,
  label: string,
): AssistantDateRange {
  return {
    dateRange: { start: getDaysAgo(fromDaysAgo), end: getDaysAgo(toDaysAgo) },
    label,
    fromDaysAgo,
    toDaysAgo,
    spanDays: Math.max(1, fromDaysAgo - toDaysAgo + 1),
  };
}

function getPreviousAssistantDateRange(range: AssistantDateRange): AssistantDateRange {
  const fromDaysAgo = range.fromDaysAgo + range.spanDays;
  const toDaysAgo = range.toDaysAgo + range.spanDays;
  return createAssistantDateRange(
    fromDaysAgo,
    toDaysAgo,
    "período imediatamente anterior",
  );
}

function normalizeSemanticText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type AssistantVisualizationIntent = "chart" | "image" | null;

function detectVisualizationIntent(content: string): AssistantVisualizationIntent {
  const normalized = normalizeSemanticText(content);

  if (
    normalized.includes("grafico") ||
    normalized.includes("chart") ||
    normalized.includes("visualizacao") ||
    normalized.includes("plot")
  ) {
    return "chart";
  }

  if (
    normalized.includes("imagem") ||
    normalized.includes("figura") ||
    normalized.includes("ilustracao") ||
    normalized.includes("foto") ||
    normalized.includes("visual")
  ) {
    return "image";
  }

  return null;
}

function tokenizeText(value: string): string[] {
  return normalizeSemanticText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  const currentRow = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex;
    let previousDiagonal = leftIndex - 1;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const savedValue = previousRow[rightIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      currentRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousDiagonal + cost,
      );
      previousDiagonal = savedValue;
    }

    for (let index = 0; index < previousRow.length; index += 1) {
      previousRow[index] = currentRow[index] ?? previousRow[index];
    }
  }

  return previousRow[right.length];
}

function isFuzzyKeywordMatch(token: string, keyword: string): boolean {
  if (token === keyword) {
    return true;
  }

  const maxDistance = keyword.length <= 5 ? 1 : 2;
  return levenshteinDistance(token, keyword) <= maxDistance;
}

function resolveAssistantDateRange(content: string): AssistantDateRange {
  const normalized = normalizeSemanticText(content);

  if (normalized.includes("anteontem")) {
    return createAssistantDateRange(2, 2, "de anteontem");
  }

  if (
    normalized.includes("ontem") ||
    normalized.includes("24 horas") ||
    normalized.includes("24h")
  ) {
    return createAssistantDateRange(1, 1, "de ontem");
  }

  if (normalized.includes("hoje")) {
    return createAssistantDateRange(0, 0, "de hoje");
  }

  if (
    normalized.includes("semana passada") ||
    normalized.includes("ultima semana") ||
    normalized.includes("ultimas 7 dias") ||
    normalized.includes("ultimos 7 dias") ||
    normalized.includes("7 dias") ||
    normalized.includes("7d")
  ) {
    return createAssistantDateRange(SHORT_WINDOW_DAYS, 0, "dos últimos 7 dias");
  }

  if (
    normalized.includes("15 dias") ||
    normalized.includes("quinzena") ||
    normalized.includes("quinzena passada")
  ) {
    return createAssistantDateRange(MID_WINDOW_DAYS, 0, "dos últimos 15 dias");
  }

  if (
    normalized.includes("90 dias") ||
    normalized.includes("3 meses") ||
    normalized.includes("trimestre")
  ) {
    return createAssistantDateRange(LONG_WINDOW_DAYS, 0, "dos últimos 90 dias");
  }

  if (
    normalized.includes("30 dias") ||
    normalized.includes("ultimas 30 dias") ||
    normalized.includes("ultimos 30 dias") ||
    normalized.includes("ultimo mes") ||
    normalized.includes("mes passado") ||
    normalized.includes("30d")
  ) {
    return createAssistantDateRange(
      DEFAULT_ASSISTANT_WINDOW_DAYS,
      0,
      "dos últimos 30 dias",
    );
  }

  return createAssistantDateRange(
    DEFAULT_ASSISTANT_WINDOW_DAYS,
    0,
    "dos últimos 30 dias",
  );
}

async function finalizeAssistantResponse(
  response: AiAssistantMessageResponseDto,
  question: string,
  scopeOverride?: AiAssistantScope,
  conversationContext?: {
    conversationHistory: OllamaChatMessage[];
    conversationMemory: string | null;
  },
): Promise<AiAssistantMessageResponseDto> {
  try {
    const refinedResponse = await composeAssistantAnswerWithOllama({
      scope: scopeOverride ?? response.scope,
      question,
      fallbackAnswer: response.answer,
      contextSummary: response.contextSummary,
      citations: response.citations,
      suggestedQuestions: response.suggestedQuestions,
      conversationHistory: conversationContext?.conversationHistory ?? [],
      conversationMemory: conversationContext?.conversationMemory ?? null,
    });

    return {
      ...response,
      answer: refinedResponse.answer,
      contextSummary: refinedResponse.contextSummary,
      thinking: refinedResponse.thinking,
      generation: refinedResponse.generation,
    };
  } catch (error) {
    // Ollama refinamento falhou (timeout, etc.) — retorna a resposta original
    // da coleta de dados em vez de mostrar "Não consegui consolidar"
    console.warn("⚠️ [AI_ASSISTANT_SERVICE] Ollama refinement failed, using data-collected answer:", error instanceof Error ? error.message : String(error));
    return response;
  }
}

function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function scoreScopeMatches(content: string, scope: AiAssistantScope): ScopeMatchScore {
  const normalized = normalizeSemanticText(content);
  const tokens = tokenizeText(content);
  const definitions = SCOPE_KEYWORDS[scope];
  let score = 0;
  let hits = 0;

  for (const definition of definitions) {
    if (normalized.includes(definition.keyword)) {
      score += definition.weight;
      hits += 1;
      continue;
    }

    if (definition.keyword.includes(" ")) {
      continue;
    }

    if (tokens.some((token) => isFuzzyKeywordMatch(token, definition.keyword))) {
      score += definition.weight * 0.75;
      hits += 1;
    }
  }

  return { scope, score, hits };
}

function compareScopeScores(left: ScopeMatchScore, right: ScopeMatchScore): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.hits !== left.hits) {
    return right.hits - left.hits;
  }

  return SCOPE_PRIORITY.indexOf(left.scope) - SCOPE_PRIORITY.indexOf(right.scope);
}

function detectStrongScopeOverride(content: string): AiAssistantScope | null {
  const normalized = normalizeSemanticText(content);

  if (
    (normalized.includes("problema") || normalized.includes("problemas") || normalized.includes("falha") || normalized.includes("falhas")) &&
    (normalized.includes("recorrente") || normalized.includes("recorrentes")) &&
    (normalized.includes("impacto") || normalized.includes("impactos") || normalized.includes("tendencia") || normalized.includes("tendencias"))
  ) {
    return "problems";
  }

  if (
    (normalized.includes("projeto") || normalized.includes("projetos")) &&
    (normalized.includes("impacto") || normalized.includes("impactos") || normalized.includes("urgencia") || normalized.includes("urgente") || normalized.includes("continuidade") || normalized.includes("continuidade operacional"))
  ) {
    return "projects";
  }

  return null;
}

export function detectScope(content: string): AiAssistantScope | null {
  const strongOverride = detectStrongScopeOverride(content);
  if (strongOverride) {
    return strongOverride;
  }

  const scopeScores = SCOPE_PRIORITY.map((scope) => scoreScopeMatches(content, scope)).filter(
    (entry) => entry.score > 0,
  );

  if (scopeScores.length > 0) {
    scopeScores.sort(compareScopeScores);
    const winner = scopeScores[0];

    if (winner) {
      return winner.scope;
    }
  }

  const normalized = normalizeSemanticText(content);
  if (matchesAny(normalized, PROJECT_KEYWORDS)) {
    return "general";
  }

  return null;
}

export function getScopeScoreBreakdown(content: string): ScopeMatchScore[] {
  return SCOPE_PRIORITY.map((scope) => scoreScopeMatches(content, scope)).sort(compareScopeScores);
}

function buildCitation(label: string, detail?: string | null): AiAssistantCitationDto {
  return { label, detail: detail ?? null };
}

function formatList(items: string[]): string {
  return items.filter(Boolean).join(", ");
}

function formatDelta(current: number, previous: number, decimals = 1): string {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(decimals)}`;
}

function describeTrend(current: number, previous: number, higherIsBetter: boolean): string {
  const delta = current - previous;
  if (delta === 0) {
    return "permaneceu estável";
  }

  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "melhorou" : "piorou";
}

function countOpenTasks(tasksByStatus: Record<string, number>): number {
  return Object.entries(tasksByStatus)
    .filter(([status]) => status !== "done")
    .reduce((sum, [, count]) => sum + count, 0);
}

function buildEffectivenessSummary(
  currentAvailability: number,
  previousAvailability: number,
  currentProblems: number,
  previousProblems: number,
): string {
  const availabilityImproved = currentAvailability >= previousAvailability;
  const problemsImproved = currentProblems <= previousProblems;

  if (availabilityImproved && problemsImproved) {
    return "melhora clara";
  }

  if (availabilityImproved || problemsImproved) {
    return "sinal misto";
  }

  return "piora";
}

function formatTopProblems(
  topProblems: Array<{ title: string; category: { name: string }; solutionsCount: number }>,
): string[] {
  return topProblems.slice(0, 3).map((problem) => {
    const solutionText =
      problem.solutionsCount > 0
        ? `${problem.solutionsCount} solução(ões)`
        : "sem solução registrada";
    return `${problem.title} (${problem.category.name}, ${solutionText})`;
  });
}

function formatTopProducts(
  products: Array<{
    name: string;
    availabilityPercentage: number;
    interventionsCount: number;
  }>,
): string[] {
  return [...products]
    .sort((left, right) => left.availabilityPercentage - right.availabilityPercentage)
    .slice(0, 3)
    .map(
      (product) =>
        `${product.name} (${product.availabilityPercentage}% de disponibilidade, ${product.interventionsCount} intervenções)`,
    );
}

function formatTopProblemProducts(
  products: Array<{
    name: string;
    totalProblems: number;
    totalSolutions: number;
    activityRate: number;
  }>,
): string[] {
  return [...products]
    .sort((left, right) => right.totalProblems - left.totalProblems)
    .slice(0, 3)
    .map(
      (product) =>
        `${product.name} (${product.totalProblems} problemas, ${product.totalSolutions} soluções)`,
    );
}

function formatProjectsWithLowerProgress(
  projects: Array<{ name: string; progress: number; status: string }>,
): string[] {
  return [...projects]
    .sort((left, right) => left.progress - right.progress)
    .slice(0, 3)
    .map(
      (project) =>
        `${project.name} (${project.progress}% de progresso, status ${project.status})`,
    );
}

function getSuggestedQuestions(scope: AiAssistantScope): string[] {
  switch (scope) {
    case "models":
      return [
        "Quais produtos estão com pior disponibilidade?",
        "Onde houve mais intervenções nos últimos 30 dias?",
        "Comparar 7 dias com 30 dias para os modelos críticos.",
      ];
    case "pending":
      return [
        "Quais projetos têm mais tarefas em aberto?",
        "Quais pendências estão travando a execução?",
        "Quais times estão mais sobrecarregados?",
      ];
    case "reports":
      return [
        "Qual relatório devo abrir primeiro?",
        "O que mudou na última semana?",
        "Mostre um resumo executivo do cenário atual.",
      ];
    case "problems":
      return [
        "Quais categorias mais cresceram?",
        "Quais problemas ainda não têm solução?",
        "Quais produtos concentram mais falhas?",
      ];
    case "solutions":
      return [
        "Quais soluções aparecem mais vezes?",
        "Quais soluções têm melhor taxa de resolução?",
        "Onde houve reabertura de problema?",
      ];
    case "projects":
      return [
        "Quais projetos têm menor progresso?",
        "Quais atividades concentram mais pendências?",
        "Quais projetos merecem revisão hoje?",
      ];
    default:
      return [...DEFAULT_FOLLOW_UPS];
  }
}

function buildScopelessReply(): AiAssistantMessageResponseDto {
  return {
    threadId: randomUUID(),
    scope: "general",
    isInScope: false,
    refusalReason: "Pergunta fora do escopo do Silo.",
    answer:
      "Posso ajudar apenas com temas do Silo: modelos, pendências, relatórios, problemas, soluções, projetos, atividades e monitoramento. Faça uma pergunta nesse contexto e eu continuo.",
    suggestedQuestions: [...DEFAULT_FOLLOW_UPS],
    citations: [],
    contextSummary: "A pergunta recebida não está ligada ao domínio do projeto.",
    generation: {
      provider: "ollama",
      model: config.ollama.model,
      status: "fallback",
      latencyMs: 0,
      errorMessage: "Pergunta fora do escopo do Silo.",
    } satisfies AiAssistantGenerationDto,
  };
}

function buildUnavailableReply(
  threadId: string,
  scope: AiAssistantScope,
  error: unknown,
): AiAssistantMessageResponseDto {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Falha ao consolidar a resposta do assistente.";

  return {
    threadId,
    scope,
    isInScope: true,
    refusalReason: null,
    answer:
      "Não consegui consolidar os dados do Silo agora. Tente novamente em instantes ou refaça a pergunta com um recorte mais específico.",
    suggestedQuestions: getSuggestedQuestions(scope),
    citations: [],
    contextSummary:
      "A geração da resposta falhou ao consolidar os dados do domínio solicitado.",
    generation: {
      provider: "ollama",
      model: config.ollama.model,
      status: "fallback",
      latencyMs: 0,
      errorMessage,
    } satisfies AiAssistantGenerationDto,
  };
}

function buildModelsAnswer(
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  dashboardSummary: Awaited<ReturnType<typeof getDashboardSummary>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  previousAvailability?: Awaited<ReturnType<typeof getAvailabilityReport>>,
  previousExecutive?: Awaited<ReturnType<typeof getExecutiveReport>>,
  periodLabel: string = "dos últimos 30 dias",
): AiAssistantMessageResponseDto {
  const weakestProducts = formatTopProducts(availability.products);
  const problemHeavyProducts = formatTopProblemProducts(executive.topProducts);
  const topCategories = dashboardSummary.topCategories.map(
    (category) => `${category.name} (${category.count})`,
  );
  const comparisonLines = [
    previousAvailability
      ? `Comparado ao período anterior, a disponibilidade média foi de ${previousAvailability.avgAvailability}% para ${availability.avgAvailability}% (${formatDelta(availability.avgAvailability, previousAvailability.avgAvailability)} p.p.).`
      : null,
    previousAvailability
      ? `As intervenções passaram de ${previousAvailability.totalInterventions} para ${availability.totalInterventions} (${formatDelta(availability.totalInterventions, previousAvailability.totalInterventions, 0)}).`
      : null,
    previousExecutive
      ? `Os problemas passaram de ${previousExecutive.summary.totalProblems} para ${executive.summary.totalProblems} (${formatDelta(executive.summary.totalProblems, previousExecutive.summary.totalProblems, 0)}).`
      : null,
    previousAvailability && previousExecutive
      ? `Se a meta era reduzir falhas e aumentar estabilidade, o resultado ficou como ${buildEffectivenessSummary(availability.avgAvailability, previousAvailability.avgAvailability, executive.summary.totalProblems, previousExecutive.summary.totalProblems)}.`
      : null,
  ].filter((line): line is string => Boolean(line));

  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    `No recorte ${periodLabel}, o Silo mostra ${availability.totalProducts} produtos monitorados, disponibilidade média de ${availability.avgAvailability}% e ${availability.totalInterventions} intervenções registradas.`,
    weakestProducts.length > 0
      ? `Os pontos mais sensíveis estão em ${formatList(weakestProducts)}.`
      : null,
    problemHeavyProducts.length > 0
      ? `Os produtos com mais problemas ${periodLabel} são ${formatList(problemHeavyProducts)}.`
      : null,
    topCategories.length > 0
      ? `As categorias de alerta mais recorrentes no dashboard são ${formatList(topCategories)}.`
      : null,
    ...comparisonLines,
    "Se quiser, eu posso detalhar por produto, por turno ou comparar o período atual com o anterior.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "models",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("models"),
    citations: [
      buildCitation(
        "Relatório de disponibilidade",
        `${availability.totalProducts} produtos e média de ${availability.avgAvailability}%`,
      ),
      buildCitation(
        "Dashboard de problemas",
        `${dashboardSummary.recentCount} ocorrências recentes`,
      ),
    ],
    contextSummary: `Contexto de modelos montado com disponibilidade, intervenções e tendência recente de problemas ${periodLabel}.`,
  };
}

function buildProblemsAnswer(
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  dashboardSummary: Awaited<ReturnType<typeof getDashboardSummary>>,
  dashboardCauses: Awaited<ReturnType<typeof getDashboardProblemsCauses>>,
  dashboardSolutions: Awaited<ReturnType<typeof getDashboardProblemsSolutions>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  periodLabel = "dos últimos 30 dias",
  previousProblems?: Awaited<ReturnType<typeof getProblemsReport>>,
): AiAssistantMessageResponseDto {
  const categoryLines = problems.problemsByCategory
    .slice(0, 3)
    .map(
      (category) =>
        `${category.name} (${category.problemsCount} ocorrências, ${category.avgResolutionHours.toFixed(1)}h)`,
    );
  const topProblemLines = formatTopProblems(problems.topProblems);
  const productProblemLines = formatTopProblemProducts(executive.topProducts);
  const comparisonLines = [
    previousProblems
      ? `Comparado ao período anterior, os problemas foram de ${previousProblems.totalProblems} para ${problems.totalProblems} (${formatDelta(problems.totalProblems, previousProblems.totalProblems, 0)}).`
      : null,
    previousProblems
      ? `O tempo médio de resolução foi de ${previousProblems.avgResolutionHours.toFixed(1)}h para ${problems.avgResolutionHours.toFixed(1)}h (${formatDelta(problems.avgResolutionHours, previousProblems.avgResolutionHours)}h).`
      : null,
    previousProblems
      ? `Nesse recorte, o cenário ${describeTrend(problems.totalProblems, previousProblems.totalProblems, false)}.`
      : null,
  ].filter((line): line is string => Boolean(line));
  const causeLines = dashboardCauses.labels.map(
    (label, index) => `${label} (${dashboardCauses.values[index] ?? 0})`,
  );
  const solutionLines = dashboardSolutions.categories
    .slice(0, 3)
    .map(
      (category, index) =>
        `${category}: ${dashboardSolutions.problems[index] ?? 0} problemas / ${dashboardSolutions.solutions[index] ?? 0} soluções`,
    );

  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    `No recorte ${periodLabel}, o Silo registrou ${problems.totalProblems} problemas e tempo médio de resolução de ${problems.avgResolutionHours.toFixed(1)} horas.`,
    categoryLines.length > 0
      ? `As categorias mais recorrentes são ${formatList(categoryLines)}.`
      : null,
    topProblemLines.length > 0
      ? `Os problemas que mais se destacam são ${formatList(topProblemLines)}.`
      : null,
    productProblemLines.length > 0
      ? `Os produtos com mais problemas são ${formatList(productProblemLines)}.`
      : null,
    causeLines.length > 0
      ? `No dashboard dos últimos ${DASHBOARD_CONTEXT_WINDOW_DAYS} dias, as causas mais frequentes aparecem em ${formatList(causeLines)}.`
      : null,
    solutionLines.length > 0
      ? `As soluções observadas no dashboard dos últimos ${DASHBOARD_CONTEXT_WINDOW_DAYS} dias seguem este padrão: ${formatList(solutionLines)}.`
      : null,
    ...comparisonLines,
    "Se quiser, eu posso separar por produto, por categoria ou por período menor.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "problems",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("problems"),
    citations: [
      buildCitation(
        "Relatório de problemas",
        `${problems.totalProblems} problemas e média de ${problems.avgResolutionHours.toFixed(1)}h`,
      ),
      buildCitation(
        "Dashboard de causas",
        `${dashboardCauses.labels.length} categorias rastreadas`,
      ),
      buildCitation(
        "Dashboard de soluções",
        `${dashboardSolutions.categories.length} séries acompanhadas`,
      ),
    ],
    contextSummary: `Contexto de problemas e soluções montado com categorias, recorrência, causas e padrões de resposta ${periodLabel}.`,
  };
}

function buildProjectsAnswer(
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  periodLabel: string = "dos últimos 30 dias",
  previousProjects?: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantMessageResponseDto {
  const lowerProgress = formatProjectsWithLowerProgress(projects.projectsWithProgress);
  const activeProjectLines = projects.mostActiveProjects
    .slice(0, 3)
    .map((project) => `${project.name} (${project.activityCount} atividades)`);
  const taskStatusLines = Object.entries(projects.tasksByStatus).map(
    ([status, count]) => `${status}: ${count}`,
  );
  const comparisonLines = [
    previousProjects
      ? `O progresso médio dos projetos foi de ${previousProjects.summary.avgProgress}% para ${projects.summary.avgProgress}% (${formatDelta(projects.summary.avgProgress, previousProjects.summary.avgProgress)} p.p.).`
      : null,
    previousProjects
      ? `As tarefas observadas passaram de ${previousProjects.summary.totalTasks} para ${projects.summary.totalTasks} (${formatDelta(projects.summary.totalTasks, previousProjects.summary.totalTasks, 0)}).`
      : null,
  ].filter((line): line is string => Boolean(line));
  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    `No recorte ${periodLabel}, o Silo mostra ${projects.summary.totalProjects} projetos, progresso médio de ${projects.summary.avgProgress}% e ${projects.summary.totalTasks} tarefas observadas.`,
    lowerProgress.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgress)}.`
      : null,
    activeProjectLines.length > 0
      ? `Os projetos mais ativos ${periodLabel} são ${formatList(activeProjectLines)}.`
      : null,
    taskStatusLines.length > 0
      ? `As tarefas se distribuem assim: ${formatList(taskStatusLines)}.`
      : null,
    `No resumo executivo, há ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e ${executive.summary.totalSolutions} soluções ${periodLabel}.`,
    ...comparisonLines,
    "Se quiser, eu posso sugerir as ações para acelerar os projetos mais lentos.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "projects",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("projects"),
    citations: [
      buildCitation(
        "Relatório de projetos",
        `${projects.summary.totalProjects} projetos e média de ${projects.summary.avgProgress}%`,
      ),
      buildCitation(
        "Resumo executivo",
        `${executive.summary.totalProducts} produtos e ${executive.summary.totalProblems} problemas`,
      ),
    ],
    contextSummary: `Contexto de projetos montado com progresso, tarefas e resumo executivo da operação ${periodLabel}.`,
  };
}

function buildPendingAnswer(
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  periodLabel: string,
  previousProjects?: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantMessageResponseDto {
  const lowerProgress = formatProjectsWithLowerProgress(projects.projectsWithProgress);
  const taskStatusLines = Object.entries(projects.tasksByStatus).map(
    ([status, count]) => `${status}: ${count}`,
  );
  const openTaskCount = countOpenTasks(projects.tasksByStatus);
  const previousOpenTaskCount = previousProjects
    ? countOpenTasks(previousProjects.tasksByStatus)
    : null;
  const comparisonLines = [
    previousOpenTaskCount !== null
      ? `As pendências em aberto passaram de ${previousOpenTaskCount} para ${openTaskCount} (${formatDelta(openTaskCount, previousOpenTaskCount, 0)}).`
      : null,
    previousProjects
      ? `O progresso médio foi de ${previousProjects.summary.avgProgress}% para ${projects.summary.avgProgress}% (${formatDelta(projects.summary.avgProgress, previousProjects.summary.avgProgress)} p.p.).`
      : null,
  ].filter((line): line is string => Boolean(line));

  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    `No recorte ${periodLabel}, o Silo mostra ${projects.summary.totalProjects} projetos, ${projects.summary.totalTasks} tarefas observadas e ${openTaskCount} pendências em aberto.`,
    lowerProgress.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgress)}.`
      : null,
    taskStatusLines.length > 0
      ? `As tarefas se distribuem assim: ${formatList(taskStatusLines)}.`
      : null,
    `No resumo executivo, há ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e ${executive.summary.totalSolutions} soluções ${periodLabel}.`,
    ...comparisonLines,
    "Se quiser, eu posso separar as pendências por prioridade, por time ou por atividade mais crítica.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "pending",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("pending"),
    citations: [
      buildCitation(
        "Relatório de projetos",
        `${projects.summary.totalProjects} projetos e média de ${projects.summary.avgProgress}%`,
      ),
      buildCitation(
        "Resumo executivo",
        `${executive.summary.totalProducts} produtos e ${executive.summary.totalProblems} problemas`,
      ),
    ],
    contextSummary: `Contexto de pendências montado com tarefas em aberto, avanço dos projetos e resumo executivo da operação ${periodLabel}.`,
  };
}

function buildGeneralAnswer(
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
  periodLabel: string = "dos últimos 30 dias",
  previousExecutive?: Awaited<ReturnType<typeof getExecutiveReport>>,
  previousAvailability?: Awaited<ReturnType<typeof getAvailabilityReport>>,
  previousProblems?: Awaited<ReturnType<typeof getProblemsReport>>,
  previousProjects?: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantMessageResponseDto {
  const weakProducts = formatTopProducts(availability.products);
  const problemHeavyProducts = formatTopProblemProducts(executive.topProducts);
  const activeProjectLines = projects.mostActiveProjects
    .slice(0, 3)
    .map((project) => `${project.name} (${project.activityCount} atividades)`);
  const lowerProgressLines = formatProjectsWithLowerProgress(projects.projectsWithProgress);
  const comparisonLines = [
    previousAvailability
      ? `A disponibilidade média foi de ${previousAvailability.avgAvailability}% para ${availability.avgAvailability}% (${formatDelta(availability.avgAvailability, previousAvailability.avgAvailability)} p.p.).`
      : null,
    previousProblems
      ? `Os problemas foram de ${previousProblems.totalProblems} para ${problems.totalProblems} (${formatDelta(problems.totalProblems, previousProblems.totalProblems, 0)}).`
      : null,
    previousProjects
      ? `O progresso médio dos projetos foi de ${previousProjects.summary.avgProgress}% para ${projects.summary.avgProgress}% (${formatDelta(projects.summary.avgProgress, previousProjects.summary.avgProgress)} p.p.).`
      : null,
    previousExecutive
      ? `No resumo executivo, o total de problemas passou de ${previousExecutive.summary.totalProblems} para ${executive.summary.totalProblems}.`
      : null,
  ].filter((line): line is string => Boolean(line));

  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    `Resumo geral ${periodLabel}: ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas, ${executive.summary.totalSolutions} soluções e ${executive.summary.totalProjects} projetos.`,
    `A disponibilidade média ${periodLabel} é de ${availability.avgAvailability}% e o relatório de problemas aponta ${problems.totalProblems} ocorrências com média de ${problems.avgResolutionHours.toFixed(1)} horas para resolução.`,
    weakProducts.length > 0
      ? `Os produtos com menor disponibilidade ${periodLabel} são ${formatList(weakProducts)}.`
      : null,
    problemHeavyProducts.length > 0
      ? `Os produtos/modelos com mais problemas ${periodLabel} são ${formatList(problemHeavyProducts)}.`
      : null,
    activeProjectLines.length > 0
      ? `Os projetos mais ativos ${periodLabel} são ${formatList(activeProjectLines)}.`
      : null,
    lowerProgressLines.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgressLines)}.`
      : null,
    ...comparisonLines,
    `Nos projetos, o progresso médio está em ${projects.summary.avgProgress}% e há ${projects.summary.totalTasks} tarefas observadas ${periodLabel}.`,
    "Se você quiser, eu posso detalhar por modelo, por problema, por tarefa ou por projeto e indicar a ação prioritária.",
  ].join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "general",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("general"),
    citations: [
      buildCitation(
        "Resumo executivo",
        `${executive.summary.totalProducts} produtos e ${executive.summary.totalProjects} projetos`,
      ),
      buildCitation("Disponibilidade", `${availability.avgAvailability}% de média`),
      buildCitation("Problemas", `${problems.totalProblems} problemas`),
      buildCitation("Projetos", `${projects.summary.totalTasks} tarefas`),
    ],
    contextSummary: `Contexto geral da operação montado a partir de relatórios e dashboards consolidados ${periodLabel}.`,
  };
}

function buildReportsAnswer(
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  periodLabel: string = "dos últimos 30 dias",
): AiAssistantMessageResponseDto {
  const answer = [
    `📅 **Período analisado:** ${periodLabel}.`,
    "Se a dúvida é por onde começar, eu abriria nesta ordem: disponibilidade por produto, problemas mais frequentes e projetos/atividades.",
    `${periodLabel}, a operação tem ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e disponibilidade média de ${availability.avgAvailability}%.`,
    `O relatório de problemas mostra ${problems.totalProblems} ocorrências e tempo médio de resolução de ${problems.avgResolutionHours.toFixed(1)} horas ${periodLabel}.`,
    "Se você quiser, eu posso detalhar cada relatório e comparar os cortes de 7, 30 e 90 dias.",
  ].join("\n\n");

  return {
    threadId: randomUUID(),
    scope: "reports",
    isInScope: true,
    refusalReason: null,
    answer,
    suggestedQuestions: getSuggestedQuestions("reports"),
    citations: [
      buildCitation(
        "Relatório executivo",
        `${executive.summary.totalProducts} produtos e ${executive.summary.totalProblems} problemas`,
      ),
      buildCitation("Disponibilidade", `${availability.avgAvailability}% de média`),
      buildCitation("Problemas", `${problems.totalProblems} ocorrências`),
    ],
    contextSummary: `Contexto de relatórios montado com visão executiva, disponibilidade e problemas ${periodLabel}.`,
  };
}

function truncateVisualizationText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildAssistantImageVisualization(input: {
  title: string;
  subtitle?: string;
  footer?: string;
  accentColor: string;
  metrics: Array<{ label: string; value: string }>;
}): AiAssistantVisualizationDto {
  const width = 1100;
  const rowHeight = 80;
  const topMargin = 160;
  const metricsHeight = input.metrics.length * (rowHeight + 16) + 32;
  const height = topMargin + metricsHeight + 120;
  const accentColor = input.accentColor;
  const safeTitle = escapeSvgText(truncateVisualizationText(input.title, 56));
  const safeSubtitle = input.subtitle
    ? escapeSvgText(truncateVisualizationText(input.subtitle, 100))
    : "";
  const safeFooter = input.footer
    ? escapeSvgText(truncateVisualizationText(input.footer, 80))
    : "";

  const metricRows = input.metrics.map((metric, index) => {
    const y = topMargin + 32 + index * (rowHeight + 16);
    const safeLabel = escapeSvgText(truncateVisualizationText(metric.label, 36));
    const safeValue = escapeSvgText(truncateVisualizationText(metric.value, 32));

    return `
      <g transform="translate(56, ${y})">
        <rect x="0" y="0" width="988" height="${rowHeight}" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
        <rect x="0" y="0" width="5" height="${rowHeight}" rx="3" fill="${accentColor}" />
        <text x="28" y="34" font-family="Inter, -apple-system, sans-serif" font-size="18" fill="#64748b" font-weight="500">${safeLabel}</text>
        <text x="28" y="60" font-family="Inter, -apple-system, sans-serif" font-size="24" fill="#0f172a" font-weight="700">${safeValue}</text>
      </g>`;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.12" />
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <!-- Fundo -->
      <rect width="${width}" height="${height}" rx="20" fill="#ffffff" />

      <!-- Barra de cabeçalho -->
      <rect x="56" y="50" width="6" height="70" rx="3" fill="${accentColor}" />

      <!-- Título -->
      <text x="80" y="78" font-family="Inter, -apple-system, sans-serif" font-size="32" fill="#0f172a" font-weight="700">${safeTitle}</text>
      <text x="80" y="108" font-family="Inter, -apple-system, sans-serif" font-size="17" fill="#64748b" font-weight="400">${safeSubtitle}</text>

      <!-- Linha separadora -->
      <line x1="56" y1="138" x2="${width - 56}" y2="138" stroke="#e2e8f0" stroke-width="1" />

      <!-- Métricas -->
      ${metricRows.join("")}

      <!-- Rodapé -->
      <line x1="56" y1="${height - 70}" x2="${width - 56}" y2="${height - 70}" stroke="#e2e8f0" stroke-width="1" />
      <text x="56" y="${height - 38}" font-family="Inter, -apple-system, sans-serif" font-size="15" fill="#94a3b8" font-weight="400">${safeFooter}</text>
    </svg>`;

  return {
    kind: "image",
    src: buildSvgDataUri(svg),
    alt: input.title,
    caption: input.subtitle,
    width,
    height,
  };
}

function buildAssistantChartVisualization(input: {
  title: string;
  subtitle?: string;
  chartType: "bar" | "line" | "donut";
  categories: string[];
  series: Array<{ name: string; values: number[]; color?: string }>;
  height?: number;
}): AiAssistantVisualizationDto {
  return {
    kind: "chart",
    chartType: input.chartType,
    title: input.title,
    subtitle: input.subtitle,
    categories: input.categories,
    series: input.series,
    height: input.height,
  };
}

/**
 * Constrói um diagrama Mermaid a partir de uma definição.
 *
 * O diagrama pode ser:
 * - `graph TD` — fluxograma (tasks, processos)
 * - `flowchart LR` — fluxo horizontal (organograma)
 * - `gantt` — gráfico de Gantt (cronograma)
 *
 * @param input.diagram  Definição Mermaid (ex.: "graph TD\\nA[Início] --> B[Fim]")
 * @param input.title    Título exibido acima do diagrama
 * @param input.caption  Legenda opcional
 */
function buildAssistantMermaidVisualization(input: {
  diagram: string;
  title: string;
  caption?: string;
}): AiAssistantVisualizationDto {
  return {
    kind: "mermaid",
    diagram: input.diagram,
    title: input.title,
    caption: input.caption,
  };
}

/**
 * Gera um diagrama de fluxo de projetos no formato Mermaid.
 * Mostra a relação entre projetos, atividades e tarefas.
 */
function buildProjectFlowDiagram(
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): string {
  const lines: string[] = ["flowchart LR"];

  // Subgraph: projetos
  lines.push("  subgraph Projetos[Projetos]");
  lines.push("    direction TB");

  for (const project of projects.projectsWithProgress.slice(0, 6)) {
    const safeName = project.name.replace(/[^a-zA-Z0-9À-ÿ ]/g, "").slice(0, 20);
    const id = `P_${project.id.slice(0, 6)}`;
    const progress = project.progress;
    const statusEmoji =
      project.status === "active" ? "🟢" : project.status === "completed" ? "✅" : "⏸️";
    lines.push(`    ${id}["${statusEmoji} ${safeName} (${progress}%)"]`);
  }
  lines.push("  end");

  // Subgraph: status
  const statusCount = projects.projectsByStatus;
  lines.push("  subgraph Status[Situação]");
  lines.push("    direction LR");
  let statusIdx = 0;
  for (const [status, count] of Object.entries(statusCount)) {
    const sId = `S_${statusIdx++}`;
    const label =
      status === "active"
        ? "Ativo"
        : status === "completed"
          ? "Concluído"
          : status === "paused"
            ? "Pausado"
            : status;
    lines.push(`    ${sId}["${label}: ${count}"]`);
  }
  lines.push("  end");

  // Subgraph: tarefas
  const tasks = projects.tasksByStatus;
  lines.push("  subgraph Tarefas[Tarefas]");
  lines.push("    direction LR");
  let taskIdx = 0;
  for (const [status, count] of Object.entries(tasks)) {
    const tId = `T_${taskIdx++}`;
    const label =
      status === "done"
        ? "Concluídas"
        : status === "in_progress"
          ? "Em andamento"
          : status === "pending"
            ? "Pendentes"
            : status;
    lines.push(`    ${tId}["${label}: ${count}"]`);
  }
  lines.push("  end");

  // Conexões
  if (projects.projectsWithProgress.length > 0) {
    const firstProj = `P_${projects.projectsWithProgress[0].id.slice(0, 6)}`;
    lines.push(`    ${firstProj} --> Status`);
    lines.push(`    ${firstProj} --> Tarefas`);
  }

  return lines.join("\n");
}

/**
 * Gera um diagrama Mermaid focado em pendências/tarefas.
 * Mostra a distribuição de tarefas por status e projetos ativos.
 */
function buildPendingFlowDiagram(
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): string {
  const lines: string[] = ["flowchart TB"];

  lines.push("  subgraph Topo[Visão Geral]");
  lines.push("    direction LR");
  lines.push(`    Total["📊 Total: ${projects.summary.totalTasks} tarefas"]`);
  lines.push(`    Progresso["📈 Progresso médio: ${projects.summary.avgProgress}%"]`);
  lines.push(`    Ativos["🟢 Projetos ativos: ${projects.projectsByStatus.active ?? 0}"]`);
  lines.push("  end");

  // Tarefas por status
  lines.push("  subgraph Tarefas[Distribuição de Tarefas]");
  lines.push("    direction LR");
  let tIdx = 0;
  for (const [status, count] of Object.entries(projects.tasksByStatus)) {
    const tId = `TS_${tIdx++}`;
    const emoji =
      status === "done" ? "✅" : status === "in_progress" ? "🔄" : "⏳";
    const label =
      status === "done"
        ? "Concluídas"
        : status === "in_progress"
          ? "Em andamento"
          : status === "pending"
            ? "Pendentes"
            : status;
    lines.push(`    ${tId}["${emoji} ${label}: ${count}"]`);
  }
  lines.push("  end");

  // Projetos em andamento
  const activeProjects = projects.projectsWithProgress.filter(
    (p) => p.status === "active",
  );
  if (activeProjects.length > 0) {
    lines.push("  subgraph Ativos[Projetos Ativos]");
    lines.push("    direction LR");
    for (const proj of activeProjects.slice(0, 5)) {
      const pId = `AP_${proj.id.slice(0, 6)}`;
      const name = proj.name.replace(/[^a-zA-Z0-9À-ÿ ]/g, "").slice(0, 18);
      lines.push(`    ${pId}["${name} (${proj.progress}%)"]`);
    }
    lines.push("  end");

    // Conecta
    lines.push(`    Topo --> Tarefas`);
    lines.push(`    Tarefas --> Ativos`);
  }

  return lines.join("\n");
}

function buildModelsVisualization(
  intent: AssistantVisualizationIntent,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  previousAvailability?: Awaited<ReturnType<typeof getAvailabilityReport>>,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    return buildAssistantImageVisualization({
      title: "Visão de modelos",
      subtitle: previousAvailability
        ? `Comparação do período atual com a referência anterior.`
        : "Resumo visual do recorte atual.",
      footer: `Baseado em ${availability.totalProducts} produtos monitorados e ${availability.totalInterventions} intervenções.`,
      accentColor: "#3b82f6",
      metrics: [
        { label: "Produtos", value: String(availability.totalProducts) },
        { label: "Disponibilidade média", value: `${availability.avgAvailability}%` },
        { label: "Intervenções", value: String(availability.totalInterventions) },
      ],
    });
  }

  const weakestProducts = [...availability.products]
    .sort((left, right) => left.availabilityPercentage - right.availabilityPercentage)
    .slice(0, 5);

  return buildAssistantChartVisualization({
    title: "Disponibilidade por produto",
    subtitle: previousAvailability
      ? `Produtos mais sensíveis no recorte atual.`
      : "Menores índices de disponibilidade no período.",
    chartType: "bar",
    categories: weakestProducts.map((product) => product.name),
    series: [
      {
        name: "Disponibilidade (%)",
        values: weakestProducts.map((product) => product.availabilityPercentage),
        color: "#3b82f6",
      },
    ],
    height: 300,
  });
}

function buildProblemsVisualization(
  intent: AssistantVisualizationIntent,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  dashboardCauses: Awaited<ReturnType<typeof getDashboardProblemsCauses>>,
  dashboardSolutions: Awaited<ReturnType<typeof getDashboardProblemsSolutions>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  periodLabel: string,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    return buildAssistantImageVisualization({
      title: "Visão de problemas",
      subtitle: `Recorte ${periodLabel}.`,
      footer: `O dashboard acompanhou ${dashboardCauses.labels.length} causas e ${dashboardSolutions.categories.length} séries de solução.`,
      accentColor: "#ef4444",
      metrics: [
        { label: "Problemas", value: String(problems.totalProblems) },
        { label: "Tempo médio", value: `${problems.avgResolutionHours.toFixed(1)}h` },
        { label: "Produtos com falhas", value: String(executive.topProducts.length) },
      ],
    });
  }

  const categories = [...problems.problemsByCategory]
    .sort((left, right) => right.problemsCount - left.problemsCount)
    .slice(0, 5);

  return buildAssistantChartVisualization({
    title: "Problemas por categoria",
    subtitle: `Categorias com maior volume de ocorrências no recorte ${periodLabel}.`,
    chartType: "bar",
    categories: categories.map((category) => category.name),
    series: [
      {
        name: "Problemas",
        values: categories.map((category) => category.problemsCount),
        color: "#ef4444",
      },
    ],
    height: 300,
  });
}

function buildProjectsVisualization(
  intent: AssistantVisualizationIntent,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    // Gera diagrama Mermaid do fluxo de projetos
    const diagram = buildProjectFlowDiagram(projects);
    return buildAssistantMermaidVisualization({
      diagram,
      title: "Fluxo dos Projetos",
      caption: `Diagrama com ${projects.summary.totalProjects} projetos, ${projects.summary.totalActivities} atividades e ${projects.summary.totalTasks} tarefas.`,
    });
  }

  const slowestProjects = [...projects.projectsWithProgress]
    .sort((left, right) => left.progress - right.progress)
    .slice(0, 5);

  return buildAssistantChartVisualization({
    title: "Projetos com menor progresso",
    subtitle: "Os projetos mais lentos no período atual.",
    chartType: "bar",
    categories: slowestProjects.map((project) => project.name),
    series: [
      {
        name: "Progresso (%)",
        values: slowestProjects.map((project) => project.progress),
        color: "#8b5cf6",
      },
    ],
    height: 300,
  });
}

function buildPendingVisualization(
  intent: AssistantVisualizationIntent,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    // Gera diagrama Mermaid focado em tarefas pendentes
    const diagram = buildPendingFlowDiagram(projects);
    return buildAssistantMermaidVisualization({
      diagram,
      title: "Fluxo de Pendências",
      caption: `Distribuição de ${projects.summary.totalTasks} tarefas entre projetos e status.`,
    });
  }

  const statuses = Object.entries(projects.tasksByStatus);

  return buildAssistantChartVisualization({
    title: "Pendências por status",
    subtitle: "Distribuição das tarefas em aberto e em andamento.",
    chartType: "donut",
    categories: statuses.map(([status]) => status),
    series: [
      {
        name: "Tarefas",
        values: statuses.map(([, count]) => count),
      },
    ],
    height: 300,
  });
}

function buildGeneralVisualization(
  intent: AssistantVisualizationIntent,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    return buildAssistantImageVisualization({
      title: "Resumo executivo",
      subtitle: "Visão consolidada do cenário atual.",
      footer: "Os indicadores abaixo resumem a operação no recorte atual.",
      accentColor: "#6366f1",
      metrics: [
        { label: "Produtos", value: String(executive.summary.totalProducts) },
        { label: "Problemas", value: String(executive.summary.totalProblems) },
        { label: "Projetos", value: String(executive.summary.totalProjects) },
      ],
    });
  }

  return buildAssistantChartVisualization({
    title: "Resumo operacional",
    subtitle: "Principais indicadores do recorte atual.",
    chartType: "bar",
    categories: [
      "Produtos",
      "Disponibilidade (%)",
      "Problemas",
      "Tempo de resolução (h)",
      "Projetos",
      "Tarefas",
    ],
    series: [
      {
        name: "Volume",
        values: [
          executive.summary.totalProducts,
          availability.avgAvailability,
          problems.totalProblems,
          problems.avgResolutionHours,
          projects.summary.totalProjects,
          projects.summary.totalTasks,
        ],
        color: "#6366f1",
      },
    ],
    height: 300,
  });
}

function buildReportsVisualization(
  intent: AssistantVisualizationIntent,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
): AiAssistantVisualizationDto | undefined {
  if (!intent) return undefined;

  if (intent === "image") {
    return buildAssistantImageVisualization({
      title: "Resumo de relatórios",
      subtitle: "Pontos de atenção para abrir primeiro.",
      footer: `A operação consolidou ${availability.totalProducts} produtos e ${problems.totalProblems} problemas no recorte atual.`,
      accentColor: "#0f766e",
      metrics: [
        { label: "Disponibilidade média", value: `${availability.avgAvailability}%` },
        { label: "Problemas", value: String(problems.totalProblems) },
        { label: "Produtos", value: String(executive.summary.totalProducts) },
      ],
    });
  }

  return buildAssistantChartVisualization({
    title: "Visão executiva",
    subtitle: "Indicadores de prioridade para abrir primeiro.",
    chartType: "bar",
    categories: ["Produtos", "Problemas", "Soluções", "Projetos"],
    series: [
      {
        name: "Resumo",
        values: [
          executive.summary.totalProducts,
          executive.summary.totalProblems,
          executive.summary.totalSolutions,
          executive.summary.totalProjects,
        ],
        color: "#0f766e",
      },
    ],
    height: 300,
  });
}

export function getAssistantExamples(): AiAssistantExamplesResponseDto {
  return {
    guidance: DEFAULT_GUIDANCE,
    scopePolicy: DEFAULT_SCOPE_POLICY,
    examples: DEFAULT_EXAMPLES,
  };
}

export async function getAssistantRuntimeStatus(): Promise<AiAssistantRuntimeStatusDto> {
  const probe = await probeOllamaRuntime({
    model: config.ollama.model,
    timeoutMs: Math.min(config.ollama.timeoutMs, 3_000),
  });

  return {
    provider: "ollama",
    model: probe.model,
    mode: probe.isReachable ? "ollama" : "fallback",
    latencyMs: probe.latencyMs,
    checkedAt: new Date().toISOString(),
    fallbackReason: probe.isReachable ? null : probe.errorMessage,
  };
}

export async function answerAssistantMessage(
  request: AssistantMessageRequest,
): Promise<AiAssistantMessageResponseDto> {
  const threadId = request.threadId ?? randomUUID();
  const conversationContext = {
    conversationHistory: request.historyMessages ?? [],
    conversationMemory: request.conversationMemory ?? null,
  };
  const scope =
    detectScope(request.content) ??
    (await classifyAssistantScopeWithOllama({
      question: request.content,
      lastKnownScope: request.lastKnownScope ?? null,
      conversationHistory: conversationContext.conversationHistory,
      conversationMemory: conversationContext.conversationMemory,
    }));
  const currentDateRange = resolveAssistantDateRange(request.content);
  const previousDateRange = getPreviousAssistantDateRange(currentDateRange);
  const { dateRange, label: periodLabel } = currentDateRange;
  const visualizationIntent = detectVisualizationIntent(request.content);

  if (!scope) {
    return {
      ...buildScopelessReply(),
      threadId,
    };
  }

  try {
    switch (scope) {
      case "models": {
        const [availability, dashboardSummary, executive, previousAvailability, previousExecutive] = await Promise.all([
          getAvailabilityReport(dateRange),
          getDashboardSummary(),
          getExecutiveReport(dateRange),
          getAvailabilityReport(previousDateRange.dateRange),
          getExecutiveReport(previousDateRange.dateRange),
        ]);
        const visualization = buildModelsVisualization(
          visualizationIntent,
          availability,
          previousAvailability,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildModelsAnswer(
              availability,
              dashboardSummary,
              executive,
              previousAvailability,
              previousExecutive,
              periodLabel,
            ),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
      case "pending": {
        const [projects, executive, previousProjects] = await Promise.all([
          getProjectsReport(dateRange),
          getExecutiveReport(dateRange),
          getProjectsReport(previousDateRange.dateRange),
        ]);
        const visualization = buildPendingVisualization(
          visualizationIntent,
          projects,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildPendingAnswer(projects, executive, periodLabel, previousProjects),
            request.content,
            "pending",
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
      case "projects": {
        const [projects, executive, previousProjects] = await Promise.all([
          getProjectsReport(dateRange),
          getExecutiveReport(dateRange),
          getProjectsReport(previousDateRange.dateRange),
        ]);
        const visualization = buildProjectsVisualization(
          visualizationIntent,
          projects,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildProjectsAnswer(projects, executive, periodLabel, previousProjects),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
      case "problems": {
        const [problems, dashboardSummary, dashboardCauses, dashboardSolutions, executive, previousProblems] = await Promise.all([
          getProblemsReport(dateRange),
          getDashboardSummary(),
          getDashboardProblemsCauses(),
          getDashboardProblemsSolutions(),
          getExecutiveReport(dateRange),
          getProblemsReport(previousDateRange.dateRange),
        ]);
        const visualization = buildProblemsVisualization(
          visualizationIntent,
          problems,
          dashboardCauses,
          dashboardSolutions,
          executive,
          periodLabel,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildProblemsAnswer(
              problems,
              dashboardSummary,
              dashboardCauses,
              dashboardSolutions,
              executive,
              periodLabel,
              previousProblems,
            ),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
      case "solutions": {
        const [problems, dashboardSummary, dashboardCauses, dashboardSolutions, executive, previousProblems] = await Promise.all([
          getProblemsReport(dateRange),
          getDashboardSummary(),
          getDashboardProblemsCauses(),
          getDashboardProblemsSolutions(),
          getExecutiveReport(dateRange),
          getProblemsReport(previousDateRange.dateRange),
        ]);
        const response = buildProblemsAnswer(
          problems,
          dashboardSummary,
          dashboardCauses,
          dashboardSolutions,
          executive,
          periodLabel,
          previousProblems,
        );
        const visualization = buildProblemsVisualization(
          visualizationIntent,
          problems,
          dashboardCauses,
          dashboardSolutions,
          executive,
          periodLabel,
        );
        return {
          ...(await finalizeAssistantResponse(
            response,
            request.content,
            "solutions",
            conversationContext,
          )),
          visualization,
          threadId,
          scope: "solutions",
          suggestedQuestions: getSuggestedQuestions("solutions"),
          contextSummary: `Contexto de soluções montado a partir do comportamento dos problemas e do dashboard ${periodLabel}.`,
        };
      }
      case "reports": {
        const [executive, problems, availability] = await Promise.all([
          getExecutiveReport(dateRange),
          getProblemsReport(dateRange),
          getAvailabilityReport(dateRange),
        ]);
        const visualization = buildReportsVisualization(
          visualizationIntent,
          executive,
          problems,
          availability,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildReportsAnswer(executive, problems, availability, periodLabel),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
      case "generate_pdf": {
        // Detecta qual tipo de relatório gerar baseado na mensagem do usuário
        const contentLower = request.content.toLowerCase();
        let pdfType: "availability" | "problems" | "executive" | "projects" = "executive";
        if (/disponibilidade|modelo|turno|intervenção/i.test(contentLower)) pdfType = "availability";
        else if (/problema|falha|incidente|erro|solução/i.test(contentLower)) pdfType = "problems";
        else if (/projeto|atividade|task|cronograma/i.test(contentLower)) pdfType = "projects";

        const [executive, problems, availability, projects] = await Promise.all([
          getExecutiveReport(dateRange),
          getProblemsReport(dateRange),
          getAvailabilityReport(dateRange),
          getProjectsReport(dateRange),
        ]);

        // Seleciona os dados conforme o tipo
        const pdfData = pdfType === "availability" ? availability
          : pdfType === "problems" ? problems
          : pdfType === "projects" ? projects
          : executive;

        let pdfUrl: string | null = null;
        try {
          const pdf = await generatePdf({
            type: pdfType,
            data: pdfData as unknown as Record<string, unknown>,
            periodLabel,
          });
          pdfUrl = pdf.url;
          console.log(`✅ [AI_ASSISTANT] PDF gerado: ${pdf.filename}`);
        } catch (err) {
          console.error("❌ [AI_ASSISTANT] Erro ao gerar PDF:", err);
        }

        const visualization: AiAssistantVisualizationDto = pdfUrl
          ? {
              kind: "image",
              src: pdfUrl,
              alt: `Relatório em PDF — ${pdfType}`,
              caption: `📄 Relatório de ${pdfType === "availability" ? "Disponibilidade" : pdfType === "problems" ? "Problemas" : pdfType === "projects" ? "Projetos" : "Executivo"} gerado. Clique no link para baixar.`,
            }
          : { kind: "image", src: "", alt: "Erro ao gerar PDF", caption: "Não foi possível gerar o PDF." };

        return {
          ...(await finalizeAssistantResponse(
            buildReportsAnswer(executive, problems, availability, periodLabel),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
          scope: "generate_pdf",
          suggestedQuestions: [
            "Gere um PDF do relatório de disponibilidade",
            "Exporte o relatório de problemas para PDF",
            "Quero baixar o relatório executivo em PDF",
          ],
        };
      }
      case "general":
      default: {
        const [executive, availability, problems, projects, previousExecutive, previousAvailability, previousProblems, previousProjects] = await Promise.all([
          getExecutiveReport(dateRange),
          getAvailabilityReport(dateRange),
          getProblemsReport(dateRange),
          getProjectsReport(dateRange),
          getExecutiveReport(previousDateRange.dateRange),
          getAvailabilityReport(previousDateRange.dateRange),
          getProblemsReport(previousDateRange.dateRange),
          getProjectsReport(previousDateRange.dateRange),
        ]);
        const visualization = buildGeneralVisualization(
          visualizationIntent,
          executive,
          availability,
          problems,
          projects,
        );
        return {
          ...(await finalizeAssistantResponse(
            buildGeneralAnswer(
              executive,
              availability,
              problems,
              projects,
              periodLabel,
              previousExecutive,
              previousAvailability,
              previousProblems,
              previousProjects,
            ),
            request.content,
            undefined,
            conversationContext,
          )),
          visualization,
          threadId,
        };
      }
    }
  } catch (error) {
    console.error("❌ [AI_ASSISTANT_SERVICE] Falha ao gerar resposta:", {
      scope,
      threadId,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack ?? null,
            }
          : error,
    });

    return buildUnavailableReply(threadId, scope, error);
  }
}