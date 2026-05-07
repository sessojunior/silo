import { db } from "@silo/database";
import {
  product,
  productActivity,
  productProblemCategory,
  productProblem,
  productSolution,
  project,
  projectTask,
} from "@silo/database/schema";
import { and, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import {
  formatDate,
  formatDateBR,
  getDaysAgo,
  getMonthsAgo,
} from "@silo/engine/date";
import { NO_INCIDENTS_CATEGORY_ID } from "@silo/engine/constants";
import { SHIFT_CODES } from "@silo/engine/domain/scheduling";

type AlertStatus = "pending" | "not_run" | "with_problems" | "run_again" | "under_support" | "suspended";

const INCIDENT_STATUS = new Set<AlertStatus>(["pending", "not_run", "with_problems", "run_again", "under_support", "suspended"]);

type DashboardSummary = {
  recentCount: number;
  previousCount: number;
  trend: number | null;
  topCategories: Array<{ name: string; count: number }>;
};

type DashboardProblemsCauses = {
  labels: string[];
  values: number[];
  colors: Array<string | null>;
};

type DashboardProblemsSolutions = {
  categories: string[];
  problems: number[];
  solutions: number[];
};

type DashboardProject = {
  projectId: string;
  name: string;
  shortDescription: string;
  progress: number;
  daysElapsed: number;
  time: string;
};

const defaultTurns: string[] = [...SHIFT_CODES];

const normalizeTurns = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number") return String(item);
        return null;
      })
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    return normalized.length > 0 ? normalized : [...defaultTurns];
  }
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  return [...defaultTurns];
};

function isAlert(status: string): status is AlertStatus {
  return INCIDENT_STATUS.has(status as AlertStatus);
}

export async function getDashboardData() {
  const products = await db.select().from(product).where(eq(product.available, true));
  if (products.length === 0) return [];

  const cutoff = getMonthsAgo(2);
  const activityRows = await db
    .select()
    .from(productActivity)
    .where(gte(productActivity.date, cutoff))
    .orderBy(productActivity.date, productActivity.turn);

  const grouped = new Map<string, {
    productId: string;
    name: string;
    priority: string;
    turns: string[];
    last_run: string | null;
    percent_completed: number;
    dates: { id: string; date: string; turn: number; user_id: string; status: string; description: string | null; intervention: string | null; category_id: string | null; alert: boolean }[];
  }>();

  for (const p of products) {
    grouped.set(p.id, {
      productId: p.id,
      name: p.name,
      priority: p.priority,
      turns: normalizeTurns(p.turns),
      last_run: null,
      percent_completed: 0,
      dates: [],
    });
  }

  for (const row of activityRows) {
    const g = grouped.get(row.productId);
    if (!g) continue;

    const dateStr = formatDate(row.date);
    g.dates.push({
      id: row.id,
      date: dateStr,
      turn: row.turn,
      user_id: row.userId,
      status: row.status,
      description: row.description,
      intervention: row.intervention,
      category_id: row.problemCategoryId ?? null,
      alert: isAlert(row.status),
    });

    const updatedAtStr = row.updatedAt.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace("T", " ");
    if (!g.last_run || updatedAtStr > g.last_run) g.last_run = updatedAtStr;
  }

  const cut28 = getDaysAgo(28);
  for (const g of grouped.values()) {
    const last28 = g.dates.filter((d) => d.date >= cut28);
    const completed = last28.filter((d) => d.status === "completed").length;
    g.percent_completed = last28.length ? Math.round((completed / last28.length) * 100) : 0;
  }

  return Array.from(grouped.values());
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const dateStr7 = getDaysAgo(7);
  const dateStr14 = getDaysAgo(14);

  const rows = await db
    .select({ date: productActivity.date, categoryId: productActivity.problemCategoryId })
    .from(productActivity)
    .where(
      and(
        gte(productActivity.date, dateStr14),
        isNotNull(productActivity.problemCategoryId),
        inArray(productActivity.status, Array.from(INCIDENT_STATUS) as [string, ...string[]]),
        ne(productActivity.problemCategoryId, NO_INCIDENTS_CATEGORY_ID),
      ),
    );

  let recentCount = 0;
  let previousCount = 0;
  const recentCatMap = new Map<string, number>();

  for (const row of rows) {
    if (!row.categoryId) continue;
    if (row.date >= dateStr7) {
      recentCount++;
      recentCatMap.set(row.categoryId, (recentCatMap.get(row.categoryId) || 0) + 1);
    } else {
      previousCount++;
    }
  }

  const topCategories: Array<{ name: string; count: number }> = [];
  const catIds = Array.from(recentCatMap.keys());

  if (catIds.length > 0) {
    const catRows = await db
      .select({ id: productProblemCategory.id, name: productProblemCategory.name })
      .from(productProblemCategory)
      .where(inArray(productProblemCategory.id, catIds));

    for (const category of catRows) {
      topCategories.push({
        name: category.name,
        count: recentCatMap.get(category.id) || 0,
      });
    }

    topCategories.sort((a, b) => b.count - a.count);
    topCategories.splice(5);
  }

  return {
    recentCount,
    previousCount,
    trend: previousCount === 0 ? null : ((recentCount - previousCount) / previousCount) * 100,
    topCategories,
  };
}

export async function getDashboardProblemsCauses(): Promise<DashboardProblemsCauses> {
  const cutDate = new Date();
  cutDate.setDate(cutDate.getDate() - 28);
  const cutoffStr = cutDate.toISOString().slice(0, 10);

  const rows = await db
    .select({ categoryId: productActivity.problemCategoryId })
    .from(productActivity)
    .where(
      and(
        gte(productActivity.date, cutoffStr),
        isNotNull(productActivity.problemCategoryId),
        ne(productActivity.problemCategoryId, NO_INCIDENTS_CATEGORY_ID),
      ),
    );

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    counts.set(row.categoryId, (counts.get(row.categoryId) || 0) + 1);
  }

  if (counts.size === 0) {
    return { labels: [], values: [], colors: [] };
  }

  const categoryRows = await db
    .select({ id: productProblemCategory.id, name: productProblemCategory.name, color: productProblemCategory.color })
    .from(productProblemCategory)
    .where(inArray(productProblemCategory.id, Array.from(counts.keys())));

  const labels: string[] = [];
  const values: number[] = [];
  const colors: Array<string | null> = [];

  for (const category of categoryRows) {
    labels.push(category.name);
    values.push(counts.get(category.id) || 0);
    colors.push(category.color);
  }

  return { labels, values, colors };
}

export async function getDashboardProblemsSolutions(): Promise<DashboardProblemsSolutions> {
  const totalDays = 28;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today.getTime() - (totalDays - 1) * 86_400_000);

  const problemsRows = await db
    .select({ date: productProblem.createdAt })
    .from(productProblem)
    .where(gte(productProblem.createdAt, start));

  const solutionsRows = await db
    .select({ date: productSolution.updatedAt })
    .from(productSolution)
    .where(gte(productSolution.updatedAt, start));

  const fmt = (date: Date): string =>
    formatDateBR(date.toISOString().split("T")[0]).replace(/\d{4}/, "").trim();

  const categories: string[] = [];
  const problemsCounts: number[] = Array(totalDays).fill(0);
  const solutionsCounts: number[] = Array(totalDays).fill(0);

  for (let index = totalDays - 1; index >= 0; index--) {
    categories.push(fmt(new Date(today.getTime() - index * 86_400_000)));
  }

  const getDayIndex = (dateValue: Date): number | null => {
    const diff = Math.floor((dateValue.getTime() - start.getTime()) / 86_400_000);
    return diff < 0 || diff >= totalDays ? null : diff;
  };

  for (const row of problemsRows) {
    const index = getDayIndex(new Date(row.date));
    if (index !== null) problemsCounts[index]++;
  }

  for (const row of solutionsRows) {
    const index = getDayIndex(new Date(row.date));
    if (index !== null) solutionsCounts[index]++;
  }

  return { categories, problems: problemsCounts, solutions: solutionsCounts };
}

export async function getDashboardProjects(): Promise<DashboardProject[]> {
  const activeProjects = await db.select().from(project).where(eq(project.status, "active"));
  if (activeProjects.length === 0) return [];

  const projectIds = activeProjects.map((currentProject) => currentProject.id);
  const tasks = await db
    .select({
      id: projectTask.id,
      projectId: projectTask.projectId,
      status: projectTask.status,
      startDate: projectTask.startDate,
    })
    .from(projectTask)
    .where(inArray(projectTask.projectId, projectIds));

  const summary = new Map<string, { total: number; done: number }>();
  for (const projectId of projectIds) summary.set(projectId, { total: 0, done: 0 });

  for (const task of tasks) {
    const projectSummary = summary.get(task.projectId);
    if (!projectSummary) continue;
    projectSummary.total++;
    if (task.status === "done") projectSummary.done++;
  }

  const today = new Date();

  return activeProjects.map((currentProject) => {
    const aggregate = summary.get(currentProject.id) || { total: 0, done: 0 };
    const progress = aggregate.total > 0 ? Math.round((aggregate.done / aggregate.total) * 100) : 0;

    let daysElapsed = 0;
    if (currentProject.startDate) {
      const startDate = new Date(String(currentProject.startDate));
      const diffMs = today.getTime() - startDate.getTime();
      daysElapsed = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      projectId: currentProject.id,
      name: currentProject.name,
      shortDescription: currentProject.shortDescription,
      progress,
      daysElapsed,
      time: `${daysElapsed} dias`,
    };
  });
}
