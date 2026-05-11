type ChartEmptyStateProps = {
  height?: number;
  title?: string;
  description?: string;
  className?: string;
};

const DEFAULT_TITLE = "Sem dados para exibir";
const DEFAULT_DESCRIPTION =
  "Não há informações suficientes para montar este gráfico no momento.";

export function ChartEmptyState({
  height = 320,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className = "",
}: ChartEmptyStateProps) {
  return (
    <div
      className={`flex w-full items-center justify-center px-6 text-center ${className}`}
      style={{ minHeight: height }}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          <span className="icon-[lucide--bar-chart-3] h-8 w-8" aria-hidden="true" />
        </div>
        <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}
