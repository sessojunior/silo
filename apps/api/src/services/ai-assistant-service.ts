import { randomUUID } from "node:crypto";

import {
  AiAssistantCitationDto,
  AiAssistantExampleDto,
  AiAssistantExamplesResponseDto,
  AiAssistantMessageRequestDto,
  AiAssistantMessageResponseDto,
  AiAssistantScope,
} from "@silo/engine/contracts";
import { getDaysAgo, getToday } from "@silo/engine/date";
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

const DEFAULT_GUIDANCE =
  "Pergunte apenas sobre modelos, pendências, relatórios, problemas, soluções, projetos, atividades e monitoramento do Silo.";

const DEFAULT_SCOPE_POLICY =
  "Se a pergunta sair do perímetro do projeto, a resposta deve recusar de forma curta e sugerir um tema do Silo.";

const DEFAULT_EXAMPLES: AiAssistantExampleDto[] = [
  {
    id: "models",
    title: "Modelos e rodadas",
    prompt: "Quais modelos estão com menor disponibilidade nos últimos 30 dias?",
    description: "Usa disponibilidade, intervenções e sinais de rodada.",
    scope: "models",
  },
  {
    id: "pending",
    title: "Pendências",
    prompt: "Quais pendências estão mais críticas agora?",
    description: "Mostra projetos, tarefas e avanço do trabalho.",
    scope: "pending",
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
): AiAssistantMessageResponseDto {
  const weakestProducts = formatTopProducts(availability.products);
  const topCategories = dashboardSummary.topCategories.map(
    (category) => `${category.name} (${category.count})`,
  );

  const answer = [
    `No recorte atual, o Silo mostra ${availability.totalProducts} produtos monitorados, disponibilidade média de ${availability.avgAvailability}% e ${availability.totalInterventions} intervenções registradas.`,
    weakestProducts.length > 0
      ? `Os pontos mais sensíveis estão em ${formatList(weakestProducts)}.`
      : null,
    topCategories.length > 0
      ? `As categorias de alerta mais recorrentes no dashboard são ${formatList(topCategories)}.`
      : null,
    "Se quiser, eu posso detalhar por produto, por turno ou comparar 7, 30 e 90 dias.",
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
): AiAssistantMessageResponseDto {
  const categoryLines = problems.problemsByCategory
    .slice(0, 3)
    .map(
      (category) =>
        `${category.name} (${category.problemsCount} ocorrências, ${category.avgResolutionHours.toFixed(1)}h)`,
    );
  const topProblemLines = formatTopProblems(problems.topProblems);
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
    `No recorte atual, o Silo registrou ${problems.totalProblems} problemas e tempo médio de resolução de ${problems.avgResolutionHours.toFixed(1)} horas.`,
    categoryLines.length > 0
      ? `As categorias mais recorrentes são ${formatList(categoryLines)}.`
      : null,
    topProblemLines.length > 0
      ? `Os problemas que mais se destacam são ${formatList(topProblemLines)}.`
      : null,
    causeLines.length > 0
      ? `No dashboard, as causas mais frequentes aparecem em ${formatList(causeLines)}.`
      : null,
    solutionLines.length > 0
      ? `As soluções observadas no período seguem este padrão: ${formatList(solutionLines)}.`
      : null,
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
): AiAssistantMessageResponseDto {
  const lowerProgress = formatProjectsWithLowerProgress(projects.projectsWithProgress);
  const taskStatusLines = Object.entries(projects.tasksByStatus).map(
    ([status, count]) => `${status}: ${count}`,
  );
  const answer = [
    `No recorte atual, o Silo mostra ${projects.summary.totalProjects} projetos, progresso médio de ${projects.summary.avgProgress}% e ${projects.summary.totalTasks} tarefas observadas.`,
    lowerProgress.length > 0
      ? `Os projetos com menor avanço estão em ${formatList(lowerProgress)}.`
      : null,
    taskStatusLines.length > 0
      ? `As tarefas se distribuem assim: ${formatList(taskStatusLines)}.`
      : null,
    `No resumo executivo, há ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas e ${executive.summary.totalSolutions} soluções no recorte atual.`,
    "Se quiser, eu posso separar por prioridade, por time ou por atividade mais crítica.",
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

function buildGeneralAnswer(
  executive: Awaited<ReturnType<typeof getExecutiveReport>>,
  availability: Awaited<ReturnType<typeof getAvailabilityReport>>,
  problems: Awaited<ReturnType<typeof getProblemsReport>>,
  projects: Awaited<ReturnType<typeof getProjectsReport>>,
): AiAssistantMessageResponseDto {
  const answer = [
    `Resumo geral: ${executive.summary.totalProducts} produtos, ${executive.summary.totalProblems} problemas, ${executive.summary.totalSolutions} soluções e ${executive.summary.totalProjects} projetos no recorte atual.`,
    `A disponibilidade média é de ${availability.avgAvailability}% e o relatório de problemas aponta ${problems.totalProblems} ocorrências com média de ${problems.avgResolutionHours.toFixed(1)} horas para resolução.`,
    `Nos projetos, o progresso médio está em ${projects.summary.avgProgress}% e há ${projects.summary.totalTasks} tarefas observadas.`,
    "Se você quiser um corte mais específico, eu posso separar por modelos, pendências, problemas, soluções ou projetos.",
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

  if (!scope) {
    return {
      ...buildScopelessReply(),
      threadId,
    };
  }

  const dateRange = { start: getDaysAgo(30), end: getToday() };

  switch (scope) {
    case "models": {
      const [availability, dashboardSummary] = await Promise.all([
        getAvailabilityReport(dateRange),
        getDashboardSummary(),
      ]);
      return { ...buildModelsAnswer(availability, dashboardSummary), threadId };
    }
    case "pending": {
      const [projects, executive] = await Promise.all([
        getProjectsReport(dateRange),
        getExecutiveReport(dateRange),
      ]);
      const answer = buildProjectsAnswer(projects, executive);
      return {
        ...answer,
        threadId,
        scope: "pending",
        suggestedQuestions: [
          "Quais projetos estão mais atrasados?",
          "Quais tarefas estão travando a execução?",
          "Quais times precisam de apoio agora?",
        ],
      };
    }
    case "projects": {
      const [projects, executive] = await Promise.all([
        getProjectsReport(dateRange),
        getExecutiveReport(dateRange),
      ]);
      return { ...buildProjectsAnswer(projects, executive), threadId };
    }
    case "problems": {
      const [problems, dashboardSummary, dashboardCauses, dashboardSolutions] = await Promise.all([
        getProblemsReport(dateRange),
        getDashboardSummary(),
        getDashboardProblemsCauses(),
        getDashboardProblemsSolutions(),
      ]);
      return {
        ...buildProblemsAnswer(
          problems,
          dashboardSummary,
          dashboardCauses,
          dashboardSolutions,
        ),
        threadId,
      };
    }
    case "solutions": {
      const [problems, dashboardSummary, dashboardCauses, dashboardSolutions] = await Promise.all([
        getProblemsReport(dateRange),
        getDashboardSummary(),
        getDashboardProblemsCauses(),
        getDashboardProblemsSolutions(),
      ]);
      const response = buildProblemsAnswer(
        problems,
        dashboardSummary,
        dashboardCauses,
        dashboardSolutions,
      );
      return {
        ...response,
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
      return { ...buildReportsAnswer(executive, problems, availability), threadId };
    }
    case "general":
    default: {
      const [executive, availability, problems, projects] = await Promise.all([
        getExecutiveReport(dateRange),
        getAvailabilityReport(dateRange),
        getProblemsReport(dateRange),
        getProjectsReport(dateRange),
      ]);
      return { ...buildGeneralAnswer(executive, availability, problems, projects), threadId };
    }
  }
}