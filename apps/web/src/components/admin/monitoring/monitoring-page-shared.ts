import type { PictureLinkStatus, PicturePage } from "./picture-pages-accordion";
import type { MonitoringProductItem } from "./product-monitoring-cards";

export type RadarStatus = "ok" | "delayed" | "undefined" | "off";

export type RadarItem = {
  id: string;
  name: string;
  description: string;
  logDate: string;
  logUrl: string;
  delay: string;
  delayMinutes: number | null;
  status: RadarStatus;
};

export type RadarGroup = {
  id: string;
  name: string;
  radars: RadarItem[];
};

export type RadarFile = {
  groups: RadarGroup[];
};

export type DbRadarGroup = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type DbRadar = {
  id: string;
  groupId: string;
  slug: string;
  name: string;
  description: string | null;
  webhookUrl: string | null;
  logUrl: string | null;
  status: string;
  delay: string | null;
  delayMinutes: number | null;
  logDate: string | Date | null;
  active: boolean;
};

export type UIRadarGroup = RadarGroup | (DbRadarGroup & { radars: DbRadar[] });
export type UIRadarItem = RadarItem | DbRadar;

export type MonitoringSummaryCounts = {
  ok: number;
  delayed: number;
  offline: number;
};

export type MonitoringProductSummaryCounts = {
  ran: number;
  problem: number;
  not_run: number;
};

export type MonitoringStatusTone = "ok" | "problem" | "not_run";

type DashboardTurn = MonitoringProductItem["turns"][number];

export type MonitoringTrendPoint = {
  label: string;
  value: number;
  productName: string;
  turnLabel: string;
  status: MonitoringStatusTone;
};

export type MonitoringSuccessTrendData = {
  successRate: number;
  points: MonitoringTrendPoint[];
};

export const RADAR_STATUS_UI: Record<
  RadarStatus,
  { badgeClass: string; label: string; squareTextClass: string }
> = {
  ok: {
    badgeClass: "bg-green-500 text-white",
    label: "Sem atraso",
    squareTextClass: "text-white",
  },
  delayed: {
    badgeClass: "bg-red-500 text-white",
    label: "Com atraso",
    squareTextClass: "text-white",
  },
  undefined: {
    badgeClass: "bg-zinc-400 text-white dark:bg-zinc-500",
    label: "Indefinido",
    squareTextClass: "text-white",
  },
  off: {
    badgeClass: "bg-white text-zinc-700 border border-zinc-300 dark:bg-zinc-100",
    label: "Desativado",
    squareTextClass: "text-zinc-700",
  },
};

export const RADAR_BLOCK_COLOR: Record<RadarStatus, string> = {
  ok: "bg-green-500",
  delayed: "bg-red-500",
  undefined: "bg-zinc-400 dark:bg-zinc-500",
  off: "bg-white border border-zinc-300 dark:bg-zinc-100",
};

export const SECTION_TITLE_CLASS = "pb-4 text-2xl font-medium text-zinc-900 dark:text-zinc-100";
export const CHART_COLORS = {
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  neutral: "#a1a1aa",
  background: "#e4e4e7",
};
export const MONITORING_PRODUCTS_PREVIEW_LIMIT = 3;
export const MONITORING_SUCCESS_TREND_CHART_HEIGHT = 160;
export const MONITORING_PICTURE_DONUT_CHART_HEIGHT = 128;

const MONITORING_SUCCESS_TREND_SAMPLE_COUNT = 12;

function normalizePicturePageLookupKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue.toLowerCase();
}

function buildPicturePageLookup(pages: PicturePage[]): Map<string, PicturePage> {
  const lookup = new Map<string, PicturePage>();

  pages.forEach((page) => {
    [page.id, page.slug, page.name].forEach((value) => {
      const normalizedValue = normalizePicturePageLookupKey(value);
      if (normalizedValue) {
        lookup.set(normalizedValue, page);
      }
    });
  });

  return lookup;
}

function resolvePicturePageFallback(
  page: PicturePage,
  fallbackLookup: Map<string, PicturePage>,
): PicturePage | undefined {
  const lookupKeys = [page.id, page.slug, page.name]
    .map((value) => normalizePicturePageLookupKey(value))
    .filter((key): key is string => Boolean(key));

  for (const key of lookupKeys) {
    const fallbackPage = fallbackLookup.get(key);
    if (fallbackPage) {
      return fallbackPage;
    }
  }

  return undefined;
}

export function mergePicturePagesWithFallback(
  pages: PicturePage[],
  fallbackPages: PicturePage[],
): PicturePage[] {
  if (pages.length === 0) {
    return fallbackPages;
  }

  const fallbackLookup = buildPicturePageLookup(fallbackPages);

  return pages.map((page) => {
    if (page.links.length > 0) {
      return page;
    }

    const fallbackPage = resolvePicturePageFallback(page, fallbackLookup);
    if (!fallbackPage) {
      return page;
    }

    return {
      ...page,
      links: fallbackPage.links,
    };
  });
}

export function buildRadarGroups(
  radarGroups: DbRadarGroup[] | undefined,
  radars: DbRadar[] | undefined,
  fallbackGroups: RadarGroup[],
): UIRadarGroup[] {
  if (radarGroups && radars && radarGroups.length > 0) {
    return radarGroups.map((group) => ({
      ...group,
      radars: radars.filter((radar) => radar.groupId === group.id),
    }));
  }

  return fallbackGroups;
}

export function toMonitoringStatusTone(status: DashboardTurn["status"]): MonitoringStatusTone {
  if (status === "completed") return "ok";
  if (status === "with_problems" || status === "run_again" || status === "under_support") return "problem";
  return "not_run";
}

export function getFeaturedTurn(product: MonitoringProductItem): DashboardTurn | null {
  const sortedTurns = [...product.turns].sort((left, right) => Number(right.turn) - Number(left.turn));
  return sortedTurns.find((turn) => turn.status !== "pending" && turn.status !== "not_run") ?? sortedTurns[0] ?? null;
}

export function getProductSummaryStatus(turns: MonitoringProductItem["turns"]): "ran" | "problem" | "not_run" {
  const statuses = turns.map((turn) => turn.status);

  if (
    statuses.some(
      (status) =>
        status === "with_problems" ||
        status === "run_again" ||
        status === "under_support",
    )
  ) {
    return "problem";
  }

  if (statuses.some((status) => status === "completed")) {
    return "ran";
  }

  return "not_run";
}

export function buildModelSuccessTrendData(products: MonitoringProductItem[]): MonitoringSuccessTrendData {
  const timelineRows = products
    .flatMap((product, productIndex) =>
      product.turns.map((turn, turnIndex) => ({
        productName: product.model,
        turnLabel: formatTurnLabel(turn.turn),
        status: toMonitoringStatusTone(turn.status),
        productIndex,
        turnIndex,
        turnOrder: Number(turn.turn),
      })),
    )
    .sort((left, right) => {
      if (left.productIndex !== right.productIndex) {
        return left.productIndex - right.productIndex;
      }

      const leftTurnOrder = Number.isFinite(left.turnOrder) ? left.turnOrder : left.turnIndex;
      const rightTurnOrder = Number.isFinite(right.turnOrder) ? right.turnOrder : right.turnIndex;

      if (leftTurnOrder !== rightTurnOrder) {
        return leftTurnOrder - rightTurnOrder;
      }

      return left.productName.localeCompare(right.productName);
    });

  if (timelineRows.length === 0) {
    return { successRate: 0, points: [] };
  }

  let successCount = 0;
  const cumulativePoints = timelineRows.map((row, index) => {
    if (row.status === "ok") {
      successCount += 1;
    }

    const itemCount = index + 1;
    return {
      label: String(itemCount),
      value: Number(((successCount / itemCount) * 100).toFixed(1)),
      productName: row.productName,
      turnLabel: row.turnLabel,
      status: row.status,
    } satisfies MonitoringTrendPoint;
  });

  const successRate = cumulativePoints[cumulativePoints.length - 1]?.value ?? 0;
  if (cumulativePoints.length <= MONITORING_SUCCESS_TREND_SAMPLE_COUNT) {
    return { successRate, points: cumulativePoints };
  }

  const sampledPoints: MonitoringTrendPoint[] = [];
  for (let index = 0; index < MONITORING_SUCCESS_TREND_SAMPLE_COUNT; index += 1) {
    const sampledIndex = Math.round(
      (index * (cumulativePoints.length - 1)) / (MONITORING_SUCCESS_TREND_SAMPLE_COUNT - 1),
    );
    sampledPoints.push(cumulativePoints[sampledIndex]);
  }

  return { successRate, points: sampledPoints };
}

export function formatShortDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(parsed);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function formatTurnLabel(turn: string): string {
  return `Turno ${String(turn).padStart(2, "0")}h`;
}

export function formatReferenceDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

export function getPictureStatusTone(status: PictureLinkStatus): MonitoringStatusTone {
  if (status === "ok") return "ok";
  if (status === "delayed") return "problem";
  return "not_run";
}

export function getPictureStatusLabel(status: PictureLinkStatus): string {
  if (status === "ok") return "Sem atraso";
  if (status === "delayed") return "Atrasada";
  if (status === "offline") return "Offline";
  return "Indefinida";
}

export function getHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (value == null) {
    return "Sem data";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
