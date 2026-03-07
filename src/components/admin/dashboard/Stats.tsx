import ProgressBarMultiple from "@/components/admin/dashboard/ProgressBarMultiple";

export interface StatItem {
  name: string;
  progress: number;
  color: string;
  colorDark: string;
  incidents: number;
}

type SecondaryMetric = {
  value: number;
  label: string;
};

type StatsProps = {
  productCount: number;
  items: StatItem[];
  primaryLabel?: string;
  secondaryMetrics?: SecondaryMetric[];
  progressTitleFormatter?: (item: StatItem) => string;
  legendTitleFormatter?: (item: StatItem) => string;
  legendItemNames?: string[];
};

export default function Stats({
  productCount,
  items,
  primaryLabel = "produtos",
  secondaryMetrics,
  progressTitleFormatter,
  legendTitleFormatter,
  legendItemNames,
}: StatsProps) {
  const totalTurns = items.reduce((sum, item) => sum + item.progress, 0);
  const totalIncidents = items.reduce((sum, item) => sum + item.incidents, 0);
  const topSecondaryMetrics =
    secondaryMetrics ??
    ([
      {
        value: totalIncidents,
        label: "incidentes nos ultimos 28 dias",
      },
    ] satisfies SecondaryMetric[]);
  const legendItems = legendItemNames
    ? items.filter((item) => legendItemNames.includes(item.name))
    : items;
  const getProgressTitle =
    progressTitleFormatter ??
    ((item: StatItem) => `${item.name}: ${item.progress} turnos nos ultimos 28 dias`);
  const getLegendTitle =
    legendTitleFormatter ??
    ((item: StatItem) => `${item.name}: ${item.progress} turnos nos ultimos 28 dias`);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-6">
        <div>
          <span className="text-2xl font-medium text-zinc-800 dark:text-zinc-200">
            {productCount}
          </span>
          <span className="ml-1 text-xl text-zinc-600 dark:text-zinc-300">
            {primaryLabel}
          </span>
        </div>
        {topSecondaryMetrics.map((metric) => (
          <div key={metric.label}>
            <span className="text-2xl font-medium text-zinc-800 dark:text-zinc-200">
              {metric.value}
            </span>
            <span className="ml-1 text-xl text-zinc-600 dark:text-zinc-300">
              {metric.label}
            </span>
          </div>
        ))}
      </div>

      <div className="my-4">
        <ProgressBarMultiple
          total={totalTurns}
          items={items.map(({ name, progress, color, colorDark }) => ({
            progress,
            color,
            colorDark,
            title: getProgressTitle({ name, progress, color, colorDark, incidents: 0 }),
          }))}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-200">
        {legendItems.map(({ name, progress, color, colorDark }, index) => (
          <div
            className="flex items-center gap-1.5 cursor-default"
            key={index}
            title={getLegendTitle({ name, progress, color, colorDark, incidents: 0 })}
          >
            <div
              className={`h-2 w-2 rounded-full ${color} dark:${colorDark}`}
            />
            <span>
              {name}: <span className="font-bold">{progress}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
