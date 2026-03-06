"use client";

import { ReportCard } from "./ReportCard";

export function ReportsPage() {
  const reports = [
    {
      id: "availability",
      title: "Disponibilidade por Produto",
      description: "Métricas de uptime, tempo de resposta e falhas por período",
      icon: "📊",
      color: "blue",
      metrics: ["Uptime %", "Tempo de Resposta", "Falhas por Período"],
    },
    {
      id: "problems",
      title: "Problemas Mais Frequentes",
      description: "Top problemas, frequência e tempo de resolução",
      icon: "📋",
      color: "red",
      metrics: ["Top 10 Problemas", "Frequência", "Tempo de Resolução"],
    },
    {
      id: "projects",
      title: "Projetos e Atividades",
      description: "Análise de projetos, progresso e distribuição de tarefas",
      icon: "📁",
      color: "purple",
      metrics: ["Total de Projetos", "Atividades", "Progresso Médio"],
    },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-6 flex-1">
        <div className="w-full space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="icon-[lucide--flask-conical] size-6 text-amber-700 dark:text-amber-300" />
            <div>
              <div className="text-lg font-semibold">
                Funcionalidade experimental
              </div>
              <div className="text-sm">
                Os relatórios estão em desenvolvimento e em testes de uso e
                podem apresentar resultados e informações estranhas.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
