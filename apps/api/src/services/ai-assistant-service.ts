import { randomUUID } from "node:crypto";

import {
  AiAssistantCitationDto,
  AiAssistantExampleDto,
  AiAssistantExamplesResponseDto,
  AiAssistantMessageRequestDto,
  AiAssistantMessageResponseDto,
  AiAssistantScope,
} from "@silo/engine/contracts/dto/ai-assistant";
import { getDaysAgo } from "@silo/engine/date";
import {
  getAvailabilityReport,
  getExecutiveReport,
  getProblemsReport,
  getProjectsReport,
} from "./report-service.js";
import {
  getDashboardProblemsCauses,
  getDashboardProblemsSolutions,
  getDashboardSummary,
} from "./dashboard-service.js";
import { composeAssistantAnswerWithOllama } from "./ai-assistant-llm-service.js";

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
];

const SCOPE_KEYWORDS: Array<{ scope: AiAssistantScope; keywords: string[] }> = [
  {
    scope: "models",
    keywords: ["modelo", "modelos", "rodada", "rodadas", "turno", "turnos"],
  },
  {
    scope: "pending",
    keywords: ["pendencia", "pendencias", "pendente", "pendentes", "atraso", "atrasados", "tarefas"],
  },
  {
    scope: "reports",
    keywords: ["relatorio", "relatorios", "dashboard", "resumo", "visao geral"],
  },
  {
    scope: "problems",
    keywords: ["problema", "problemas", "falha", "falhas", "incidente", "incidentes"],
  },
  {
    scope: "solutions",
    keywords: ["solucao", "solucoes", "resolver", "resolucao", "reabertura"],
  },
  {
    scope: "projects",
    keywords: ["projeto", "projetos", "atividade", "atividades", "task", "tasks"],
  },
];

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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveAssistantDateRange(content: string): AssistantDateRange {
  const normalized = normalizeText(content);

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
): Promise<AiAssistantMessageResponseDto> {
  const refinedResponse = await composeAssistantAnswerWithOllama({
    scope: scopeOverride ?? response.scope,
    question,
    fallbackAnswer: response.answer,
    contextSummary: response.contextSummary,
    citations: response.citations,
    suggestedQuestions: response.suggestedQuestions,
  });

  return {
    ...response,
    answer: refinedResponse.answer,
    contextSummary: refinedResponse.contextSummary,
    generation: refinedResponse.generation,
  };
}

function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function detectScope(content: string): AiAssistantScope | null {
  const normalized = normalizeText(content);

  for (const entry of SCOPE_KEYWORDS) {
    if (matchesAny(normalized, entry.keywords)) {
      return entry.scope;
    }
  }

  if (matchesAny(normalized, PROJECT_KEYWORDS)) {
    return "general";
  }

  return null;
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
  };
}

function buildModelsAnswer(
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  dashboardSummary: Awaited<ReturnType<typeof getDashboardSummary>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  previousAvailability?: Awaited<ReturnType<typeof getAvailabilityReport>>,
  previousExecutive?: Awaited<ReturnType<typeof getExecutiveReport>>,
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
    `No recorte atual, o Silo mostra ${availability.totalProducts} produtos monitorados, disponibilidade média de ${availability.avgAvailability}% e ${availability.totalInterventions} intervenções registradas.`,
    weakestProducts.length > 0
      ? `Os pontos mais sensíveis estão em ${formatList(weakestProducts)}.`
      : null,
    problemHeavyProducts.length > 0
      ? `Os produtos com mais problemas no período são ${formatList(problemHeavyProducts)}.`
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
    contextSummary:
      "Contexto de modelos montado com disponibilidade, intervenções e tendência recente de problemas.",
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
    contextSummary:
      "Contexto de problemas e soluções montado com categorias, recorrência, causas e padrões de resposta.",
  };
}

function buildProjectsAnswer(
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
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
    `No recorte atual, o Silo mostra ${projects.summary.totalProjects} projetos, progresso médio de ${projects.summary.avgProgress}% e ${projects.summary.totalTasks} tarefas observadas.`,
    lowerProgress.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgress)}.`
      : null,
    activeProjectLines.length > 0
      ? `Os projetos mais ativos no período são ${formatList(activeProjectLines)}.`
      : null,
    taskStatusLines.length > 0
      ? `As tarefas se distribuem assim: ${formatList(taskStatusLines)}.`
      : null,
    `No resumo executivo, há ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e ${executive.summary.totalSolutions} soluções no recorte atual.`,
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
    contextSummary:
      "Contexto de projetos montado com progresso, tarefas e resumo executivo da operação.",
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
    `No recorte ${periodLabel}, o Silo mostra ${projects.summary.totalProjects} projetos, ${projects.summary.totalTasks} tarefas observadas e ${openTaskCount} pendências em aberto.`,
    lowerProgress.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgress)}.`
      : null,
    taskStatusLines.length > 0
      ? `As tarefas se distribuem assim: ${formatList(taskStatusLines)}.`
      : null,
    `No resumo executivo, há ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e ${executive.summary.totalSolutions} soluções no recorte atual.`,
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
    contextSummary:
      "Contexto de pendências montado com tarefas em aberto, avanço dos projetos e resumo executivo da operação.",
  };
}

function buildGeneralAnswer(
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
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
    `Resumo geral: ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas, ${executive.summary.totalSolutions} soluções e ${executive.summary.totalProjects} projetos no recorte atual.`,
    `A disponibilidade média é de ${availability.avgAvailability}% e o relatório de problemas aponta ${problems.totalProblems} ocorrências com média de ${problems.avgResolutionHours.toFixed(1)} horas para resolução.`,
    weakProducts.length > 0
      ? `Os produtos com menor disponibilidade são ${formatList(weakProducts)}.`
      : null,
    problemHeavyProducts.length > 0
      ? `Os produtos/modelos com mais problemas são ${formatList(problemHeavyProducts)}.`
      : null,
    activeProjectLines.length > 0
      ? `Os projetos mais ativos são ${formatList(activeProjectLines)}.`
      : null,
    lowerProgressLines.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgressLines)}.`
      : null,
    ...comparisonLines,
    `Nos projetos, o progresso médio está em ${projects.summary.avgProgress}% e há ${projects.summary.totalTasks} tarefas observadas.`,
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
    contextSummary:
      "Contexto geral da operação montado a partir de relatórios e dashboards consolidados.",
  };
}

function buildReportsAnswer(
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
): AiAssistantMessageResponseDto {
  const answer = [
    "Se a dúvida é por onde começar, eu abriria nesta ordem: disponibilidade por produto, problemas mais frequentes e projetos/atividades.",
    `No recorte atual, a operação tem ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e disponibilidade média de ${availability.avgAvailability}%.`,
    `O relatório de problemas mostra ${problems.totalProblems} ocorrências e tempo médio de resolução de ${problems.avgResolutionHours.toFixed(1)} horas.`,
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
    contextSummary:
      "Contexto de relatórios montado com visão executiva, disponibilidade e problemas.",
  };
}

export function getAssistantExamples(): AiAssistantExamplesResponseDto {
  return {
    guidance: DEFAULT_GUIDANCE,
    scopePolicy: DEFAULT_SCOPE_POLICY,
    examples: DEFAULT_EXAMPLES,
  };
}

export async function answerAssistantMessage(
  request: AiAssistantMessageRequestDto,
): Promise<AiAssistantMessageResponseDto> {
  const threadId = request.threadId ?? randomUUID();
  const scope = detectScope(request.content);
  const currentDateRange = resolveAssistantDateRange(request.content);
  const previousDateRange = getPreviousAssistantDateRange(currentDateRange);
  const { dateRange, label: periodLabel } = currentDateRange;

  if (!scope) {
    return {
      ...buildScopelessReply(),
      threadId,
    };
  }

  switch (scope) {
    case "models": {
      const [availability, dashboardSummary, executive, previousAvailability, previousExecutive] = await Promise.all([
        getAvailabilityReport(dateRange),
        getDashboardSummary(),
        getExecutiveReport(dateRange),
        getAvailabilityReport(previousDateRange.dateRange),
        getExecutiveReport(previousDateRange.dateRange),
      ]);
      return {
        ...(await finalizeAssistantResponse(
          buildModelsAnswer(
            availability,
            dashboardSummary,
            executive,
            previousAvailability,
            previousExecutive,
          ),
          request.content,
        )),
        threadId,
      };
    }
    case "pending": {
      const [projects, executive, previousProjects] = await Promise.all([
        getProjectsReport(dateRange),
        getExecutiveReport(dateRange),
        getProjectsReport(previousDateRange.dateRange),
      ]);
      return {
        ...(await finalizeAssistantResponse(
          buildPendingAnswer(projects, executive, periodLabel, previousProjects),
          request.content,
          "pending",
        )),
        threadId,
      };
    }
    case "projects": {
      const [projects, executive, previousProjects] = await Promise.all([
        getProjectsReport(dateRange),
        getExecutiveReport(dateRange),
        getProjectsReport(previousDateRange.dateRange),
      ]);
      return {
        ...(await finalizeAssistantResponse(
          buildProjectsAnswer(projects, executive, previousProjects),
          request.content,
        )),
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
        )),
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
      return {
        ...(await finalizeAssistantResponse(response, request.content, "solutions")),
        threadId,
        scope: "solutions",
        suggestedQuestions: getSuggestedQuestions("solutions"),
        contextSummary:
          "Contexto de soluções montado a partir do comportamento dos problemas e do dashboard.",
      };
    }
    case "reports": {
      const [executive, problems, availability] = await Promise.all([
        getExecutiveReport(dateRange),
        getProblemsReport(dateRange),
        getAvailabilityReport(dateRange),
      ]);
      return {
        ...(await finalizeAssistantResponse(
          buildReportsAnswer(executive, problems, availability),
          request.content,
        )),
        threadId,
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
      return {
        ...(await finalizeAssistantResponse(
          buildGeneralAnswer(
            executive,
            availability,
            problems,
            projects,
            previousExecutive,
            previousAvailability,
            previousProblems,
            previousProjects,
          ),
          request.content,
        )),
        threadId,
      };
    }
  }
}