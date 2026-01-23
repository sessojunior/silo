"use client";

import { useState, useEffect } from "react";
import { ReportChart } from "./ReportChart";
import { ReportFilters } from "./ReportFilters";
import Avatar from "@/components/ui/Avatar";
import { formatDate, formatDateBR } from "@/lib/dateUtils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { config } from "@/lib/config";
import Button from "@/components/ui/Button";
import Offcanvas from "@/components/ui/Offcanvas";

interface ReportViewPageProps {
  reportId: string;
}

interface ReportFilters {
  dateRange: string;
  startDate?: Date;
  endDate?: Date;
}

// Interfaces específicas para cada tipo de relatório
interface AvailabilityReportData {
  products: Array<{
    id: string;
    name: string;
    availabilityPercentage: number;
    totalActivities: number;
    completedActivities: number;
    failedActivities: number;
    lastActivity?: Date;
  }>;
  summary: {
    totalProducts: number;
    averageAvailability: number;
    totalActivities: number;
    completedActivities: number;
    failedActivities: number;
  };
}

interface ProblemsReportData {
  categories: Array<{
    id: string;
    name: string;
    color: string;
    problemsCount: number;
    avgResolutionHours: number;
  }>;
  topProblems: Array<{
    id: string;
    title: string;
    categoryName: string;
    categoryColor: string;
    solutionsCount: number;
    avgResolutionHours: number;
    userInfo: {
      name: string;
      image: string;
    };
    createdAt: Date;
  }>;
  summary: {
    totalProblems: number;
    totalSolutions: number;
    averageResolutionHours: number;
  };
}

interface PerformanceReportData {
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    trend: "up" | "down" | "stable";
    change: number;
  }>;
  chartData: Array<{
    date: string;
    value: number;
  }>;
}

interface ProjectsReportData {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    startDate: Date;
    endDate?: Date;
    tasksCount: number;
    completedTasks: number;
  }>;
  summary: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    averageProgress: number;
  };
}

type ReportDataStructure =
  | AvailabilityReportData
  | ProblemsReportData
  | PerformanceReportData
  | ProjectsReportData;

type ReportType = "availability" | "problems" | "performance" | "projects";

interface ReportData {
  id: string;
  title: string;
  description: string;
  type: ReportType;
  data: ReportDataStructure;
  filters: ReportFilters;
}

type SmartCriterion = {
  id: string;
  title: string;
  description: string;
  icon: string;
  details: string[];
};

const smartCriteria: SmartCriterion[] = [
  {
    id: "specific",
    title: "Específico",
    description: "O que exatamente você quer alcançar?",
    icon: "icon-[lucide--target]",
    details: [
      "Descreva o resultado esperado com clareza, evitando termos genéricos como “melhorar” ou “otimizar” sem contexto. Use o relatório para apontar um ponto exato do processo ou produto.",
      "Defina o alvo como uma situação observável, por exemplo: reduzir falhas críticas em um conjunto específico de produtos. Isso ajuda a equipe a enxergar o que precisa mudar.",
      "Verifique se o objetivo pode ser entendido da mesma forma por qualquer pessoa que leia o relatório, garantindo alinhamento imediato.",
    ],
  },
  {
    id: "measurable",
    title: "Mensurável",
    description: "Quanto falta para atingir a meta?",
    icon: "icon-[lucide--ruler]",
    details: [
      "Transforme a meta em números claros, como porcentagens, volumes ou tempos. O relatório já fornece métricas que podem servir como base.",
      "Defina o ponto de partida e o ponto de chegada desejado, assim a evolução fica objetiva. Isso torna a análise de progresso rápida e transparente.",
      "Escolha um indicador principal para acompanhar, evitando excesso de métricas que confundem a priorização.",
    ],
  },
  {
    id: "achievable",
    title: "Atingível",
    description: "A meta é realista com os recursos atuais?",
    icon: "icon-[lucide--check-circle-2]",
    details: [
      "Considere capacidade da equipe, disponibilidade de dados e tempo de resposta atual. O relatório revela limites reais que devem ser respeitados.",
      "Metas realistas permitem ajustes graduais e sustentáveis. Um passo viável bem executado costuma gerar mais impacto do que metas inalcançáveis.",
      "Valide se a meta depende de fatores externos e ajuste o escopo para manter o controle sobre o resultado.",
    ],
  },
  {
    id: "relevant",
    title: "Relevante",
    description: "Por que esta meta é importante agora?",
    icon: "icon-[lucide--sparkles]",
    details: [
      "Conecte a meta ao objetivo estratégico do relatório, como estabilidade do serviço ou eficiência de projetos. Isso evita esforços desconectados.",
      "Priorize aquilo que gera maior impacto para usuários internos e externos. O relatório ajuda a identificar onde o impacto é mais alto.",
      "Explique o benefício esperado para a operação, facilitando a comunicação com outras áreas e patrocinadores.",
    ],
  },
  {
    id: "timebound",
    title: "Temporizável",
    description: "Em quanto tempo a meta deve ser atingida?",
    icon: "icon-[lucide--clock-3]",
    details: [
      "Estabeleça um prazo objetivo que possa ser acompanhado nos ciclos de análise. O relatório permite comparar períodos e validar ritmo.",
      "Defina marcos intermediários para acompanhar tendências, evitando descobrir atrasos apenas no fim do prazo.",
      "Alinhe o tempo com o nível de complexidade da meta, garantindo que o prazo seja desafiador, mas possível.",
    ],
  },
] as const;

const getSmartIntro = (reportType: ReportType): string => {
  switch (reportType) {
    case "availability":
      return "Direcione as metas para disponibilidade, estabilidade e continuidade operacional dos produtos.";
    case "problems":
      return "Defina metas para reduzir recorrência, acelerar resolução e melhorar a qualidade das soluções.";
    case "performance":
      return "Estabeleça metas para equilíbrio entre produtividade, colaboração e impacto em projetos.";
    case "projects":
      return "Oriente as metas para entregas, progresso sustentável e alocação eficiente de tarefas.";
    default:
      return "Estruture metas claras para orientar decisões e priorizações do relatório.";
  }
};

export function ReportViewPage({ reportId }: ReportViewPageProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: "30d",
  });
  const [isSmartOpen, setIsSmartOpen] = useState(false);
  const [openSmartId, setOpenSmartId] = useState<string | null>("specific");

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);

        // Determinar qual API chamar baseado no tipo de relatório
        let apiPath = "";
        switch (reportId) {
          case "availability":
            apiPath = "/api/admin/reports/availability";
            break;
          case "problems":
            apiPath = "/api/admin/reports/problems";
            break;
          case "performance":
            apiPath = "/api/admin/reports/performance";
            break;
          case "projects":
            apiPath = "/api/admin/reports/projects";
            break;
          default:
            throw new Error("Tipo de relatório não reconhecido");
        }

        // Construir query string com filtros - timezone São Paulo
        const queryParams = new URLSearchParams();
        if (filters.dateRange !== "30d")
          queryParams.append("dateRange", filters.dateRange);
        if (filters.startDate)
          queryParams.append("startDate", formatDate(filters.startDate));
        if (filters.endDate)
          queryParams.append("endDate", formatDate(filters.endDate));

        const apiUrl = `${config.getApiUrl(apiPath)}?${queryParams.toString()}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("❌ [COMPONENT_REPORTS] Erro da API:", {
            status: response.status,
            error: errorData,
          });
          throw new Error(
            errorData.error || "Erro ao buscar dados do relatório",
          );
        }

        const data = await response.json();

        // Mapear dados para o formato do relatório
        const reportData: ReportData = {
          id: reportId,
          title: getReportTitle(reportId),
          description: getReportDescription(reportId),
          type: reportId as
            | "availability"
            | "problems"
            | "performance"
            | "projects",
          data: data,
          filters: filters,
        };

        setReport(reportData);
      } catch (err) {
        console.error("❌ [COMPONENT_REPORTS] Erro ao buscar relatório:", {
          reportId,
          error: err,
        });
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId, filters]);

  // Recarregar relatório quando filtros mudarem
  useEffect(() => {
    if (
      report &&
      Object.values(filters).some(
        (value) => value !== "30d" && value !== undefined,
      )
    ) {
      // Recarregar o relatório quando os filtros mudarem
      // A lógica já está implementada no useEffect principal
    }
  }, [filters, report]);

  const handleFiltersChange = (newFilters: ReportFilters) => {
    setFilters(newFilters);
  };

  const getReportTitle = (id: string): string => {
    switch (id) {
      case "availability":
        return "Relatório de Disponibilidade por Produto";
      case "problems":
        return "Relatório de Problemas Mais Frequentes";
      case "performance":
        return "Relatório de Performance da Equipe - Sistema Justo e Transparente";
      case "projects":
        return "Relatório de Projetos e Atividades";
      case "executive":
        return "Relatório Executivo";
      default:
        return "Relatório";
    }
  };

  const getReportDescription = (id: string): string => {
    switch (id) {
      case "availability":
        return "Análise detalhada da disponibilidade de produtos no sistema";
      case "problems":
        return "Visão geral dos problemas mais frequentes e suas categorias";
      case "performance":
        return "Sistema de pontuação justo que reconhece problemas, soluções e participação em projetos";
      case "projects":
        return "Análise completa de projetos, atividades e progresso";
      case "executive":
        return "Resumo executivo com indicadores-chave de performance";
      default:
        return "Descrição do relatório";
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingSpinner
          text="Carregando relatório..."
          size="lg"
          variant="centered"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Erro ao carregar relatório
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              Relatório não encontrado
            </h2>
            <p className="text-yellow-600 dark:text-yellow-300 mb-4">
              O relatório solicitado não foi encontrado ou não está disponível.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {report.title}
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {report.description}
                </p>
              </div>
            </div>
            <Button
              style="bordered"
              className="w-full sm:w-auto"
              icon="icon-[lucide--target]"
              onClick={() => setIsSmartOpen(true)}
            >
              Metas
            </Button>
          </div>
        </div>
      </div>

      <Offcanvas
        open={isSmartOpen}
        onClose={() => setIsSmartOpen(false)}
        title={
          <div className="flex items-center gap-3">
            <span className="icon-[lucide--target] size-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">Metas SMART</h2>
              <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {report.title}
              </p>
            </div>
          </div>
        }
        width="lg"
      >
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-700/50 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <span className="icon-[lucide--sparkles] size-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Guia de metas aplicado ao relatório atual
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {getSmartIntro(report.type)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {smartCriteria.map((item) => {
              const isOpen = openSmartId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/40"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSmartId((prev) =>
                        prev === item.id ? null : item.id,
                      )
                    }
                    className="w-full px-4 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`${item.icon} size-5 text-zinc-600 dark:text-zinc-300 mt-0.5`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.title}
                          </p>
                          <span
                            className={`size-4 text-zinc-500 dark:text-zinc-400 ${isOpen ? "icon-[lucide--chevron-up]" : "icon-[lucide--chevron-down]"}`}
                          />
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                        {item.details.map((detail) => (
                          <p key={detail}>{detail}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-700/50 dark:bg-emerald-950/20">
            <div className="flex items-start gap-3">
              <span className="icon-[lucide--badge-check] size-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Como usar no dia a dia
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Utilize estes critérios para orientar análises, comparar
                  períodos e priorizar ações do relatório.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Offcanvas>

      {/* Filtros do Relatório - AQUI ESTÃO OS FILTROS EM CADA PÁGINA ESPECÍFICA */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ReportFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          reportType={
            reportId as "availability" | "problems" | "performance" | "projects"
          }
        />
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* Gráfico Principal */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">
              Visualização dos Dados
            </h3>
            <ReportChart
              type="bar"
              data={report.data as unknown as Record<string, unknown>}
              reportType={report.type}
            />
          </div>

          {/* Métricas */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">
              Métricas Principais
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {renderMetrics(
                report.data as unknown as Record<string, unknown>,
                report.type,
              )}
            </div>
          </div>
        </div>

        {/* Gráficos Adicionais */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">
              Tendências de Performance
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Evolução da pontuação, problemas, soluções e tarefas concluídas
              por usuário
            </p>
            <ReportChart
              type="line"
              data={report.data as unknown as Record<string, unknown>}
              reportType={report.type}
            />
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">
              {report.type === "availability"
                ? "Distribuição por Nível de Disponibilidade"
                : "Distribuição de Atividades"}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              {report.type === "availability"
                ? "Classificação dos produtos por nível de disponibilidade: Disponível (≥90%), Atenção (70-89%), Crítico (<70%)"
                : "Proporção entre tarefas atribuídas e concluídas na equipe"}
            </p>
            <ReportChart
              type="donut"
              data={report.data as unknown as Record<string, unknown>}
              reportType={report.type}
            />
          </div>
        </div>

        {/* Tabela Detalhada - Apenas para relatório de projetos */}
        {report.type === "projects" && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Detalhamento dos Projetos
              </h3>
              {renderProjectsTable(
                report.data as unknown as Record<string, unknown>,
              )}
            </div>
          </div>
        )}

        {/* Tabela Detalhada - Apenas para relatório de disponibilidade */}
        {report.type === "availability" && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Detalhamento dos Produtos
              </h3>
              {renderAvailabilityTable(
                report.data as unknown as Record<string, unknown>,
              )}
            </div>
          </div>
        )}

        {/* Tabela Detalhada - Apenas para relatório de problemas */}
        {report.type === "problems" && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Detalhamento dos Problemas
              </h3>
              {renderProblemsTable(
                report.data as unknown as Record<string, unknown>,
              )}
            </div>
          </div>
        )}

        {/* Tabela Detalhada - Apenas para relatório de performance */}
        {report.type === "performance" && (
          <div className="mt-6 sm:mt-8">
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Detalhamento da Performance da Equipe
              </h3>
              {renderPerformanceTable(
                report.data as unknown as Record<string, unknown>,
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderMetrics(data: Record<string, unknown>, reportType: string) {
  switch (reportType) {
    case "availability":
      return (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-zinc-800 dark:text-zinc-200 font-medium text-sm sm:text-base">
              Total de Produtos
            </span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold text-lg sm:text-xl">
              {(data.totalProducts as number) || 0}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-green-50 dark:bg-green-950 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-green-800 dark:text-green-200 font-medium text-sm sm:text-base">
              Disponibilidade Média
            </span>
            <span className="text-green-900 dark:text-green-100 font-bold text-lg sm:text-xl">
              {(data.avgAvailability as number)
                ? `${(data.avgAvailability as number).toFixed(1)}%`
                : "0%"}
            </span>
          </div>
        </>
      );

    case "problems":
      return (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-red-50 dark:bg-red-950 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-red-800 dark:text-red-200 font-medium text-sm sm:text-base">
              Total de Problemas
            </span>
            <span className="text-red-900 dark:text-red-100 font-bold text-lg sm:text-xl">
              {(data.totalProblems as number) || 0}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-yellow-800 dark:text-yellow-200 font-medium text-sm sm:text-base">
              Tempo Médio de Resolução
            </span>
            <span className="text-yellow-900 dark:text-yellow-100 font-bold text-lg sm:text-xl">
              {(data.avgResolutionHours as number)
                ? `${(data.avgResolutionHours as number).toFixed(1)}h`
                : "0h"}
            </span>
          </div>
        </>
      );

    case "performance":
      return (
        <>
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-2 sm:space-y-0"
            title="Total de problemas identificados no sistema (1 ponto cada)"
          >
            <span className="text-zinc-800 dark:text-zinc-200 font-medium text-sm sm:text-base">
              Total de Problemas
            </span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.totalProblems as number) || 0}
            </span>
          </div>
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-green-50 dark:bg-green-950 rounded-lg space-y-2 sm:space-y-0"
            title="Total de soluções fornecidas para problemas (2 pontos cada)"
          >
            <span className="text-green-800 dark:text-green-200 font-medium text-sm sm:text-base">
              Total de Soluções
            </span>
            <span className="text-green-900 dark:text-green-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.totalSolutions as number) || 0}
            </span>
          </div>
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-950 rounded-lg space-y-2 sm:space-y-0"
            title="Total de tarefas atribuídas em projetos (1-3 pontos dependendo do papel e status)"
          >
            <span className="text-purple-800 dark:text-purple-200 font-medium text-sm sm:text-base">
              Tarefas de Projetos
            </span>
            <span className="text-purple-900 dark:text-purple-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.totalTasks as number) || 0}
            </span>
          </div>
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-orange-50 dark:bg-orange-950 rounded-lg space-y-2 sm:space-y-0"
            title="Usuários que participam ativamente de projetos (têm tarefas atribuídas)"
          >
            <span className="text-orange-800 dark:text-orange-200 font-medium text-sm sm:text-base">
              Participantes de Projetos
            </span>
            <span className="text-orange-900 dark:text-orange-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.projectParticipants as number) || 0}
            </span>
          </div>
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-2 sm:space-y-0"
            title="Taxa média de conclusão de tarefas por todos os usuários (bônus de +5 pontos se > 80%)"
          >
            <span className="text-zinc-800 dark:text-zinc-200 font-medium text-sm sm:text-base">
              Taxa Média de Conclusão
            </span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.avgCompletionRate as number) || 0}
              %
            </span>
          </div>
        </>
      );

    case "projects":
      return (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-zinc-800 dark:text-zinc-200 font-medium text-sm sm:text-base">
              Total de Projetos
            </span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.totalProjects as number) || 0}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-green-50 dark:bg-green-950 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-green-800 dark:text-green-200 font-medium text-sm sm:text-base">
              Total de Atividades
            </span>
            <span className="text-green-900 dark:text-green-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.totalActivities as number) || 0}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-950 rounded-lg space-y-2 sm:space-y-0">
            <span className="text-purple-800 dark:text-purple-200 font-medium text-sm sm:text-base">
              Progresso Médio
            </span>
            <span className="text-purple-900 dark:text-purple-100 font-bold text-lg sm:text-xl">
              {((data.summary as Record<string, unknown>)
                ?.avgProgress as number) || 0}
              %
            </span>
          </div>
        </>
      );

    default:
      return (
        <div className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">
          Métricas não disponíveis para este tipo de relatório
        </div>
      );
  }
}

function renderProjectsTable(data: Record<string, unknown>) {
  const projectsWithProgress =
    (data.projectsWithProgress as Array<Record<string, unknown>>) || [];
  const mostActiveProjects =
    (data.mostActiveProjects as Array<Record<string, unknown>>) || [];

  if (projectsWithProgress.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Nenhum projeto encontrado para o período selecionado.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      active:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      completed:
        "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      paused:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return (
      statusColors[status] ||
      "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200"
    );
  };

  const getPriorityColor = (priority: string) => {
    const priorityColors: Record<string, string> = {
      urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      medium:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return (
      priorityColors[priority] ||
      "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200"
    );
  };

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      active: "Ativo",
      completed: "Concluído",
      paused: "Pausado",
      cancelled: "Cancelado",
    };
    return statusLabels[status] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const priorityLabels: Record<string, string> = {
      urgent: "Urgente",
      high: "Alta",
      medium: "Média",
      low: "Baixa",
    };
    return priorityLabels[priority] || priority;
  };

  // Função para obter contagem de atividades por projeto
  const getProjectActivityCount = (projectId: string) => {
    const project = mostActiveProjects.find(
      (p: Record<string, unknown>) => p.projectId === projectId,
    );
    return project ? (project.activityCount as number) : 0;
  };

  // Função para obter contagem de tarefas por projeto
  const getProjectTaskCount = () => {
    const tasksByStatus = (data.tasksByStatus as Record<string, number>) || {};
    // Para simplificar, vamos usar o total de tarefas do período
    return Object.values(tasksByStatus).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Projeto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Prioridade
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Progresso
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Atividades
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Tarefas
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Usuários
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
          {projectsWithProgress.map((project, index) => (
            <tr
              key={project.id as string}
              className={
                index % 2 === 0
                  ? "bg-white dark:bg-zinc-800"
                  : "bg-gray-50 dark:bg-zinc-700"
              }
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-400 to-zinc-500 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {(project.name as string)?.charAt(0)?.toUpperCase() ||
                          "P"}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {project.name as string}
                    </div>
                    <div
                      className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs"
                      title={project.description as string}
                    >
                      {(project.description as string) || "Sem descrição"}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status as string)}`}
                >
                  {getStatusLabel(project.status as string)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority as string)}`}
                >
                  {getPriorityLabel(project.priority as string)}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 dark:bg-zinc-700 rounded-full h-2 mr-2">
                    <div
                      className="bg-gradient-to-r from-zinc-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(project.progress as number) || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {(project.progress as number) || 0}%
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {getProjectActivityCount(project.id as string)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {getProjectTaskCount()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {((project.users as Array<Record<string, unknown>>) || [])
                    .length === 0 ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Sem usuários
                    </span>
                  ) : (
                    <div className="flex -space-x-2">
                      {(
                        (project.users as Array<Record<string, unknown>>) || []
                      ).map((user, index) => (
                        <div
                          key={user.id as string}
                          className="relative"
                          title={`${user.name as string} (${user.email as string})`}
                          style={{
                            zIndex:
                              (
                                (project.users as Array<
                                  Record<string, unknown>
                                >) || []
                              ).length - index,
                          }}
                        >
                          <div className="h-8 w-8">
                            <Avatar
                              src={user.image as string}
                              name={(user.name as string) || "Usuário"}
                              size="sm"
                              className="border-2 border-white dark:border-zinc-800 shadow-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderAvailabilityTable(data: Record<string, unknown>) {
  const products = (data.products as Array<Record<string, unknown>>) || [];

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Nenhum produto encontrado para o período selecionado.</p>
      </div>
    );
  }

  const getAvailabilityColor = (availability: number) => {
    if (availability >= 90)
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (availability >= 70)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (availability >= 50)
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const getProductStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      active:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      stable: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return (
      statusColors[status] ||
      "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200"
    );
  };

  const getProductStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      active: "Ativo",
      stable: "Estável",
      warning: "Atenção",
      critical: "Crítico",
    };
    return statusLabels[status] || status;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Produto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Disponibilidade
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Total Atividades
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Atividades Falharam
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Última Atividade
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
          {products.map((product, index) => (
            <tr
              key={product.id as string}
              className={
                index % 2 === 0
                  ? "bg-white dark:bg-zinc-800"
                  : "bg-gray-50 dark:bg-zinc-700"
              }
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-zinc-400 to-purple-500 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {(product.name as string)?.charAt(0)?.toUpperCase() ||
                          "P"}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {product.name as string}
                    </div>
                    <div
                      className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs"
                      title={product.description as string}
                    >
                      {(product.description as string) || "Sem descrição"}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getProductStatusColor((product.status as string) || "")}`}
                >
                  {getProductStatusLabel((product.status as string) || "")}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 dark:bg-zinc-700 rounded-full h-2 mr-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-zinc-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(product.availabilityPercentage as number) || 0}%`,
                      }}
                    ></div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${getAvailabilityColor((product.availabilityPercentage as number) || 0)} px-2 py-1 rounded-full`}
                  >
                    {(product.availabilityPercentage as number) || 0}%
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {(product.totalActivities as number) || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {(product.failedActivities as number) || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {(product.lastActivityDate as string)
                  ? formatDateBR(product.lastActivityDate as string)
                  : "Nunca"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function renderProblemsTable(data: Record<string, unknown>) {
  const problems = (data.topProblems as Array<Record<string, unknown>>) || [];

  if (problems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Nenhum problema encontrado para o período selecionado.</p>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      "rede externa":
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      "rede interna":
        "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      "servidor indisponível":
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "falha humana":
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "erro no software":
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      outros: "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200",
    };
    return (
      categoryColors[category.toLowerCase()] ||
      "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200"
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-zinc-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Problema
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Produto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Categoria
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Prioridade
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Soluções
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Data Criação
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Última Atualização
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
          {problems.map((problem, index) => (
            <tr
              key={problem.id as string}
              className={
                index % 2 === 0
                  ? "bg-white dark:bg-zinc-800"
                  : "bg-gray-50 dark:bg-zinc-700"
              }
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-400 to-orange-500 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">⚠️</span>
                    </div>
                  </div>
                  <div className="ml-4 min-w-0 flex-1">
                    <div
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs"
                      title={problem.title as string}
                    >
                      {(problem.title as string) || "Sem título"}
                    </div>
                    <div
                      className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs"
                      title={problem.description as string}
                    >
                      {(problem.description as string) || "Sem descrição"}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-zinc-400 to-purple-500 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {(
                          (problem.product as Record<string, unknown>)
                            ?.name as string
                        )
                          ?.charAt(0)
                          ?.toUpperCase() || "P"}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <div
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-24"
                      title={
                        (problem.product as Record<string, unknown>)
                          ?.name as string
                      }
                    >
                      {((problem.product as Record<string, unknown>)
                        ?.name as string) || "Produto não encontrado"}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(((problem.category as Record<string, unknown>)?.name as string) || "")}`}
                >
                  {((problem.category as Record<string, unknown>)
                    ?.name as string) || "Sem categoria"}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  N/A
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  N/A
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {(problem.solutionsCount as number) || 0}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {(problem.createdAt as string)
                  ? formatDateBR(problem.createdAt as string)
                  : "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {(problem.updatedAt as string)
                  ? formatDateBR(problem.updatedAt as string)
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderPerformanceTable(data: Record<string, unknown>) {
  const userPerformance =
    (data.userPerformance as Array<Record<string, unknown>>) || [];

  if (userPerformance.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Nenhum usuário encontrado para o período selecionado.</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 20)
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (score >= 10)
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
    if (score >= 5)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 20) return "Excelente";
    if (score >= 10) return "Bom";
    if (score >= 5) return "Regular";
    return "Baixo";
  };

  const getBadges = (user: Record<string, unknown>) => {
    const badges = [];
    if (user.isProjectParticipant)
      badges.push({
        text: "Projetista",
        color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      });
    if (user.hasHighCompletionRate)
      badges.push({
        text: "Eficiente",
        color:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      });
    if (user.isActiveReviewer)
      badges.push({
        text: "Mentor",
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      });
    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Tabela de Performance */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-zinc-700">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Informações básicas do usuário (nome e email)"
              >
                Usuário
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Pontuação total baseada no sistema justo de pontuação (problemas + soluções + tarefas + projetos + bônus)"
              >
                Pontuação
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Problemas criados pelo usuário (1 ponto cada)"
              >
                Problemas
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Soluções fornecidas pelo usuário (2 pontos cada)"
              >
                Soluções
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Tarefas de projetos: Atribuídas (1pt), Concluídas (3pts), Como Reviewer (2pts)"
              >
                Tarefas
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Quantos projetos únicos o usuário participa (1 ponto por projeto)"
              >
                Projetos
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Taxa de conclusão de tarefas (bônus de +5 pontos se > 80%)"
              >
                Taxa
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                title="Badges de reconhecimento: Projetista (tem tarefas), Eficiente (>80%), Mentor (reviewer)"
              >
                Badges
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-gray-700">
            {userPerformance.map((user, index) => {
              const badges = getBadges(user);
              return (
                <tr
                  key={user.userId as string}
                  className={
                    index % 2 === 0
                      ? "bg-white dark:bg-zinc-800"
                      : "bg-gray-50 dark:bg-zinc-700"
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <Avatar
                          src={user.image as string}
                          name={(user.name as string) || "Usuário"}
                          size="md"
                        />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user.name as string}
                        </div>
                        <div
                          className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs"
                          title={user.email as string}
                        >
                          {user.email as string}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    title={`Pontuação total: ${(user.totalScore as number) || 0} pontos | Base: ${(user.baseScore as number) || 0} | Bônus: ${(user.completionBonus as number) || 0} | Classificação: ${getScoreLabel((user.totalScore as number) || 0)}`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor((user.totalScore as number) || 0)}`}
                      >
                        {(user.totalScore as number) || 0} pts
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getScoreLabel((user.totalScore as number) || 0)}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    title={`Problemas criados: ${(user.problemsCreated as number) || 0} | Pontos: ${((user.problemsCreated as number) || 0) * 1} | Contribuição para identificação de issues do sistema`}
                  >
                    {(user.problemsCreated as number) || 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    title={`Soluções fornecidas: ${(user.solutionsProvided as number) || 0} | Pontos: ${((user.solutionsProvided as number) || 0) * 2} | Contribuição para resolução de problemas`}
                  >
                    {(user.solutionsProvided as number) || 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    title={`Participação em Projetos: Atribuídas: ${(user.tasksAssigned as number) || 0} (${((user.tasksAssigned as number) || 0) * 1}pts) | Concluídas: ${(user.tasksCompleted as number) || 0} (${((user.tasksCompleted as number) || 0) * 3}pts) | Como Reviewer: ${(user.tasksAsReviewer as number) || 0} (${((user.tasksAsReviewer as number) || 0) * 2}pts) | Total: ${((user.tasksAssigned as number) || 0) * 1 + ((user.tasksCompleted as number) || 0) * 3 + ((user.tasksAsReviewer as number) || 0) * 2} pontos`}
                  >
                    <div className="space-y-1">
                      <div>
                        Atribuídas: {(user.tasksAssigned as number) || 0}
                      </div>
                      <div>
                        Concluídas: {(user.tasksCompleted as number) || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        Reviewer: {(user.tasksAsReviewer as number) || 0}
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    title={`Projetos Ativos: ${(user.projectsParticipated as number) || 0} projetos únicos | Pontos: ${(user.projectsParticipated as number) || 0} | Diversidade de participação em diferentes projetos`}
                  >
                    {(user.projectsParticipated as number) || 0}
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                    title={`Taxa de Conclusão: ${(user.completionRate as number) || 0}% | Bônus: ${(user.completionRate as number) >= 80 ? "+5 pontos" : "0 pontos"} | Eficiência na finalização de tarefas | ${(user.completionRate as number) >= 80 ? "Badge &quot;Eficiente&quot; desbloqueado!" : "Meta: 80% para bônus"}`}
                  >
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 dark:bg-zinc-700 rounded-full h-2 mr-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-zinc-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(user.completionRate as number) || 0}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold">
                        {(user.completionRate as number) || 0}%
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-6 py-4 whitespace-nowrap"
                    title={`Badges de Reconhecimento: ${badges.length > 0 ? badges.map((b) => b.text).join(", ") : "Nenhum badge ainda"} | Projetista: tem tarefas em projetos | Eficiente: taxa > 80% | Mentor: atua como reviewer`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {badges.map((badge, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}
                          title={`Badge &quot;${badge.text}&quot;: ${badge.text === "Projetista" ? "Usuário participa de projetos com tarefas atribuídas" : badge.text === "Eficiente" ? "Taxa de conclusão superior a 80%" : "Usuário atua como reviewer em tarefas"}`}
                        >
                          {badge.text}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Seção de Regras de Pontuação */}
      <div className="bg-gradient-to-r from-zinc-50 to-gray-50 dark:from-zinc-900 dark:to-gray-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          📊 Sistema de Pontuação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-zinc-800 dark:text-zinc-200">
              Problemas e Soluções
            </h4>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div>
                • Problema criado:{" "}
                <span className="font-semibold">1 ponto</span>
              </div>
              <div>
                • Solução fornecida:{" "}
                <span className="font-semibold">2 pontos</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-zinc-800 dark:text-zinc-200">
              Tarefas de Projetos
            </h4>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div>
                • Tarefa concluída:{" "}
                <span className="font-semibold">3 pontos</span>
              </div>
              <div>
                • Tarefa como reviewer:{" "}
                <span className="font-semibold">2 pontos</span>
              </div>
              <div>
                • Tarefa como assignee:{" "}
                <span className="font-semibold">1 ponto</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-zinc-800 dark:text-zinc-200">
              Bônus e Participação
            </h4>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div>
                • Projeto participado:{" "}
                <span className="font-semibold">1 ponto</span>
              </div>
              <div>
                • Taxa &gt;gt; 80%:{" "}
                <span className="font-semibold">+5 pontos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Funcionalidades e Filtros */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-4">
          🎯 Funcionalidades e Filtros Disponíveis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-green-800 dark:text-green-200">
              Filtros Específicos
            </h4>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <div>
                •{" "}
                <span className="font-semibold">
                  Apenas Usuários de Projetos:
                </span>{" "}
                Focar em quem tem tarefas atribuídas
              </div>
              <div>
                • <span className="font-semibold">Por Papel:</span> Assignee vs
                Reviewer
              </div>
              <div>
                • <span className="font-semibold">Por Projeto:</span>{" "}
                Performance em projeto específico
              </div>
              <div>
                • <span className="font-semibold">Por Status de Tarefa:</span>{" "}
                Usuários com tarefas pendentes vs concluídas
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-green-800 dark:text-green-200">
              Destaques Visuais
            </h4>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <div>
                •{" "}
                <span className="font-semibold">
                  Badge &quot;Projetista Ativo&quot;:
                </span>{" "}
                Para usuários com tarefas em projetos
              </div>
              <div>
                •{" "}
                <span className="font-semibold">
                  Badge &quot;Alta Produtividade&quot;:
                </span>{" "}
                Para alta taxa de conclusão (&gt;80%)
              </div>
              <div>
                •{" "}
                <span className="font-semibold">Badge &quot;Mentor&quot;:</span>{" "}
                Para usuários que são reviewers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Métricas Específicas */}
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4">
          📈 Métricas Específicas para Projetos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-purple-800 dark:text-purple-200">
              Participação em Projetos
            </h4>
            <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <div>
                • <span className="font-semibold">Projetos Ativos:</span>{" "}
                Quantos projetos o usuário participa
              </div>
              <div>
                • <span className="font-semibold">Tarefas Pendentes:</span>{" "}
                Tarefas não concluídas
              </div>
              <div>
                • <span className="font-semibold">Tarefas Concluídas:</span>{" "}
                Tarefas finalizadas
              </div>
              <div>
                • <span className="font-semibold">Taxa de Conclusão:</span> % de
                eficiência
              </div>
              <div>
                • <span className="font-semibold">Última Atividade:</span>{" "}
                Quando foi a última tarefa concluída
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-purple-800 dark:text-purple-200">
              Liderança em Projetos
            </h4>
            <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <div>
                • <span className="font-semibold">Tarefas como Reviewer:</span>{" "}
                Quantas tarefas o usuário revisa
              </div>
              <div>
                • <span className="font-semibold">Projetos Múltiplos:</span>{" "}
                Participação em vários projetos
              </div>
              <div>
                •{" "}
                <span className="font-semibold">Tempo Médio de Resolução:</span>{" "}
                Eficiência nas tarefas
              </div>
              <div>
                •{" "}
                <span className="font-semibold">Badges de Reconhecimento:</span>{" "}
                Sistema de conquistas
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
