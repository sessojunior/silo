/**
 * Report Service — Funções puras para geração de relatórios
 * Manipula relatórios de disponibilidade, problemas, executivo e projetos
 */

import { db } from "@silo/database";
import {
  product,
  productActivity,
  productProblem,
  productProblemCategory,
  productSolution,
  project,
  projectActivity,
  projectTask,
  projectTaskUser,
  authUser,
  group,
} from "@silo/database/schema";
import { eq, and, gte, lte, ne, inArray, sql } from "drizzle-orm";
import { getToday, getDaysAgo, formatDate } from "@silo/engine/date";
import { NO_INCIDENTS_CATEGORY_ID } from "@silo/engine/constants";

const INCIDENT_STATUS = new Set(["pending", "not_run", "with_problems", "run_again", "under_support", "suspended"]);

export interface DateRange {
  start: string;
  end: string;
}

type TopProblem = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  product: { name: string; slug: string };
  category: { name: string; color: string };
  reportedBy: string;
  solutionsCount: number;
};

/**
 * Parse período de data (7d, 30d, 90d, custom)
 */
export function parsePeriod(query: Record<string, string | undefined>): DateRange {
  const { dateRange = "30d", startDate, endDate } = query;
  const end = endDate ? formatDate(endDate) : getToday();
  const start = startDate
    ? formatDate(startDate)
    : (() => {
        switch (dateRange) {
          case "7d":
            return getDaysAgo(7);
          case "90d":
            return getDaysAgo(90);
          case "custom":
            return getDaysAgo(30);
          default:
            return getDaysAgo(30);
        }
      })();
  return { start, end };
}

/**
 * Gera relatório de disponibilidade de produtos
 */
export async function getAvailabilityReport(dateRange: DateRange) {
  const { start, end } = dateRange;

  const products = await db.select().from(product).orderBy(product.name);
  if (!products.length) {
    return {
      totalProducts: 0,
      avgAvailability: 0,
      totalInterventions: 0,
      products: [],
    };
  }

  const productsWithAvailability = await Promise.all(
    products.map(async (prod) => {
      const activities = await db
        .select()
        .from(productActivity)
        .where(
          and(
            eq(productActivity.productId, prod.id),
            gte(productActivity.date, start),
            lte(productActivity.date, end),
          ),
        );

      const totalActivities = activities.length;
      const completedActivities = activities.filter((a) => a.status === "completed").length;
      const activeActivities = activities.filter((a) => a.status === "in_progress").length;
      const failedActivities = activities.filter((a) => INCIDENT_STATUS.has(a.status)).length;
      const interventionsCount = activities.filter((a) => typeof a.intervention === "string" && a.intervention.trim()).length;

      const availabilityPercentage = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 1000) / 10 : 0;

      let productStatus = "active";
      if (availabilityPercentage < 50) productStatus = "critical";
      else if (availabilityPercentage < 70) productStatus = "warning";
      else if (availabilityPercentage < 90) productStatus = "stable";

      const activitiesWithIntervention = activities.filter((a) => typeof a.intervention === "string" && a.intervention.trim());
      let latestInterventionAt: string | null = null;
      let latestInterventionText: string | null = null;
      if (activitiesWithIntervention.length > 0) {
        const latest = [...activitiesWithIntervention].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
        latestInterventionAt = formatDate(latest.date);
        latestInterventionText = latest.intervention || null;
      }

      const lastActivityDate = activities.length > 0 ? [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : null;

      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        status: productStatus,
        totalActivities,
        completedActivities,
        activeActivities,
        failedActivities,
        interventionsCount,
        latestInterventionAt,
        latestInterventionText,
        availabilityPercentage,
        lastActivityDate,
      };
    }),
  );

  const totalProducts = productsWithAvailability.length;
  const avgAvailability = totalProducts > 0 ? Math.round((productsWithAvailability.reduce((s, p) => s + p.availabilityPercentage, 0) / totalProducts) * 10) / 10 : 0;
  const totalInterventions = productsWithAvailability.reduce((s, p) => s + p.interventionsCount, 0);

  return { totalProducts, avgAvailability, totalInterventions, products: productsWithAvailability };
}

/**
 * Gera relatório de problemas por categoria
 */
export async function getProblemsReport(dateRange: DateRange, productId?: string, problemCategory?: string) {
  const { start, end } = dateRange;

  const problems = await db
    .select({
      id: productProblem.id,
      productId: productProblem.productId,
      userId: productProblem.userId,
      title: productProblem.title,
      description: productProblem.description,
      createdAt: productProblem.createdAt,
      updatedAt: productProblem.updatedAt,
      problemCategoryId: productProblem.problemCategoryId,
    })
    .from(productProblem)
    .where(
      and(
        gte(productProblem.createdAt, new Date(start + "T00:00:00")),
        lte(productProblem.createdAt, new Date(end + "T23:59:59")),
        ne(productProblem.problemCategoryId, NO_INCIDENTS_CATEGORY_ID),
        productId ? eq(productProblem.productId, productId) : undefined,
        problemCategory ? eq(productProblem.problemCategoryId, problemCategory) : undefined,
      ),
    );

  const categories = await db.select().from(productProblemCategory);

  const problemsByCategory = await Promise.all(
    categories
      .filter((cat) => cat.id !== NO_INCIDENTS_CATEGORY_ID)
      .map(async (category) => {
        const categoryProblems = problems.filter((p) => p.problemCategoryId === category.id);
        const problemsCount = categoryProblems.length;
        let avgResolutionHours = 0;

        if (problemsCount > 0) {
          const categoryProblemIds = categoryProblems.map((p) => p.id);
          const solutions = await db
            .select({ productProblemId: productSolution.productProblemId, createdAt: productSolution.createdAt })
            .from(productSolution)
            .where(inArray(productSolution.productProblemId, categoryProblemIds));

          if (solutions.length > 0) {
            const times = solutions
              .map((sol) => {
                const problem = categoryProblems.find((p) => p.id === sol.productProblemId);
                return problem ? (sol.createdAt.getTime() - problem.createdAt.getTime()) / (1000 * 60 * 60) : 0;
              })
              .filter((t) => t > 0);
            if (times.length > 0) avgResolutionHours = times.reduce((s, t) => s + t, 0) / times.length;
          }
        }

        return { id: category.id, name: category.name, color: category.color || "#6b7280", problemsCount, avgResolutionHours };
      }),
  ).then((r) => r.filter((cat) => cat.problemsCount > 0));

  const productsWithProblems = (await db.select({ id: product.id, name: product.name, slug: product.slug }).from(product))
    .map((prod) => {
      const cnt = problems.filter((p) => p.productId === prod.id).length;
      return { id: prod.id, name: prod.name, slug: prod.slug, problemsCount: cnt, resolvedCount: Math.floor(cnt * 0.8), resolutionRate: cnt > 0 ? 80 : 0 };
    })
    .filter((p) => p.problemsCount > 0);

  const totalProblems = problems.length;
  const avgResolutionHours = problemsByCategory.length > 0 ? Math.round((problemsByCategory.reduce((s, c) => s + c.avgResolutionHours, 0) / problemsByCategory.length) * 10) / 10 : 0;

  const topProblemsIds = problems.slice(0, 5).map((problem) => problem.id);
  let topProblems: TopProblem[] = [];
  if (topProblemsIds.length > 0) {
    const topProblemsData = await db
      .select({
        problemId: productProblem.id,
        problemTitle: productProblem.title,
        problemDescription: productProblem.description,
        problemCreatedAt: productProblem.createdAt,
        problemUpdatedAt: productProblem.updatedAt,
        problemCategoryId: productProblem.problemCategoryId,
        productId: productProblem.productId,
        userId: productProblem.userId,
        userName: authUser.name,
        productName: product.name,
        productSlug: product.slug,
        categoryName: productProblemCategory.name,
        categoryColor: productProblemCategory.color,
        solutionsCount: sql<number>`count(${productSolution.id})`,
      })
      .from(productProblem)
      .leftJoin(authUser, eq(productProblem.userId, authUser.id))
      .leftJoin(product, eq(productProblem.productId, product.id))
      .leftJoin(productProblemCategory, eq(productProblem.problemCategoryId, productProblemCategory.id))
      .leftJoin(productSolution, eq(productProblem.id, productSolution.productProblemId))
      .where(inArray(productProblem.id, topProblemsIds))
      .groupBy(
        productProblem.id,
        productProblem.title,
        productProblem.description,
        productProblem.createdAt,
        productProblem.updatedAt,
        productProblem.problemCategoryId,
        productProblem.productId,
        productProblem.userId,
        authUser.name,
        product.name,
        product.slug,
        productProblemCategory.name,
        productProblemCategory.color,
      );

    topProblems = topProblemsData.map((problem) => ({
      id: problem.problemId,
      title: problem.problemTitle,
      description: problem.problemDescription,
      createdAt: problem.problemCreatedAt.toISOString(),
      updatedAt: problem.problemUpdatedAt.toISOString(),
      product: {
        name: problem.productName || "Produto",
        slug: problem.productSlug || "produto",
      },
      category: {
        name: problem.categoryName || "Sem categoria",
        color: problem.categoryColor || "#6b7280",
      },
      reportedBy: problem.userName || "Usuário",
      solutionsCount: problem.solutionsCount || 0,
    }));
  }

  return { totalProblems, avgResolutionHours, topProblems, problemsByCategory, problemsByProduct: productsWithProblems };
}

/**
 * Gera relatório executivo
 */
export async function getExecutiveReport(dateRange: DateRange, productId?: string, groupId?: string) {
  const { start, end } = dateRange;

  const products = await db.select({ id: product.id, name: product.name, available: product.available, priority: product.priority }).from(product);
  const problems = await db
    .select({ id: productProblem.id, productId: productProblem.productId, createdAt: productProblem.createdAt })
    .from(productProblem)
    .where(
      and(
        gte(productProblem.createdAt, new Date(start + "T00:00:00")),
        lte(productProblem.createdAt, new Date(end + "T23:59:59")),
        productId ? eq(productProblem.productId, productId) : undefined,
      ),
    );
  const solutions = await db
    .select({ id: productSolution.id, productProblemId: productSolution.productProblemId, createdAt: productSolution.createdAt })
    .from(productSolution)
    .where(and(gte(productSolution.createdAt, new Date(start + "T00:00:00")), lte(productSolution.createdAt, new Date(end + "T23:59:59"))));
  const users = await db.select({ id: authUser.id, name: authUser.name }).from(authUser).where(eq(authUser.isActive, true));
  const groups = await db.select({ id: group.id, name: group.name }).from(group);
  const projects = await db.select({ id: project.id, name: project.name, status: project.status, priority: project.priority, startDate: project.startDate }).from(project);
  const activities = await db.select({ id: projectActivity.id, projectId: projectActivity.projectId, status: projectActivity.status }).from(projectActivity);
  const tasks = await db.select({ id: projectTask.id, projectId: projectTask.projectId, status: projectTask.status }).from(projectTask);

  const totalProducts = products.length;
  const availableProducts = products.filter((p) => p.available).length;
  const totalProblems = problems.length;
  const totalSolutions = solutions.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;

  const last7Days = getDaysAgo(7);
  const previous7Days = getDaysAgo(14);
  const recentProblems = problems.filter((p) => p.createdAt >= new Date(last7Days + "T00:00:00")).length;
  const previousProblems = problems.filter((p) => p.createdAt >= new Date(previous7Days + "T00:00:00") && p.createdAt < new Date(last7Days + "T00:00:00")).length;
  const recentSolutions = solutions.filter((s) => s.createdAt >= new Date(last7Days + "T00:00:00")).length;
  const previousSolutions = solutions.filter((s) => s.createdAt >= new Date(previous7Days + "T00:00:00") && s.createdAt < new Date(last7Days + "T00:00:00")).length;

  const productMetrics = products.map((p) => {
    const probs = problems.filter((pr) => pr.productId === p.id);
    const sols = solutions.filter((s) => problems.find((pr) => pr.id === s.productProblemId)?.productId === p.id);
    return { productId: p.id, name: p.name, available: p.available, priority: p.priority, totalProblems: probs.length, totalSolutions: sols.length, activityRate: probs.length + sols.length };
  });

  return {
    period: { start, end },
    filters: { productId, groupId },
    summary: {
      totalProducts,
      availableProducts,
      totalProblems,
      totalSolutions,
      totalUsers: users.length,
      totalGroups: groups.length,
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === "active").length,
      totalActivities: activities.length,
      totalTasks: tasks.length,
      completedTasks,
    },
    kpis: {
      taskCompletionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 1000) / 10 : 0,
    },
    trends: {
      problems: { current: recentProblems, previous: previousProblems, change: previousProblems > 0 ? ((recentProblems - previousProblems) / previousProblems) * 100 : 0 },
      solutions: { current: recentSolutions, previous: previousSolutions, change: previousSolutions > 0 ? ((recentSolutions - previousSolutions) / previousSolutions) * 100 : 0 },
    },
    productMetrics,
    topProducts: productMetrics.sort((a, b) => b.totalProblems - a.totalProblems).slice(0, 5),
  };
}

/**
 * Gera relatório de projetos
 */
export async function getProjectsReport(dateRange: DateRange) {
  const { start, end } = dateRange;

  const projectsInPeriod = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(and(gte(project.createdAt, new Date(start + "T00:00:00")), lte(project.createdAt, new Date(end + "T23:59:59"))));

  const activitiesInPeriod = await db
    .select({ id: projectActivity.id, projectId: projectActivity.projectId, name: projectActivity.name, status: projectActivity.status, createdAt: projectActivity.createdAt })
    .from(projectActivity)
    .where(and(gte(projectActivity.createdAt, new Date(start + "T00:00:00")), lte(projectActivity.createdAt, new Date(end + "T23:59:59"))));

  const tasksInPeriod = await db
    .select({
      id: projectTask.id,
      projectId: projectTask.projectId,
      projectActivityId: projectTask.projectActivityId,
      name: projectTask.name,
      status: projectTask.status,
      priority: projectTask.priority,
      createdAt: projectTask.createdAt,
    })
    .from(projectTask)
    .where(and(gte(projectTask.createdAt, new Date(start + "T00:00:00")), lte(projectTask.createdAt, new Date(end + "T23:59:59"))));

  const activeUsers = await db.select({ id: authUser.id, name: authUser.name, email: authUser.email }).from(authUser).where(eq(authUser.isActive, true));

  const tasksByStatus = tasksInPeriod.reduce((acc, t) => {
    acc[t.status || "unknown"] = (acc[t.status || "unknown"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectsByStatus = projectsInPeriod.reduce((acc, p) => {
    acc[p.status || "unknown"] = (acc[p.status || "unknown"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectsByPriority = projectsInPeriod.reduce((acc, p) => {
    acc[p.priority || "normal"] = (acc[p.priority || "normal"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectActivityCounts = activitiesInPeriod.reduce((acc, a) => {
    acc[a.projectId] = (acc[a.projectId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostActiveProjects = Object.entries(projectActivityCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([projectId, count]) => ({
      projectId,
      name: projectsInPeriod.find((p) => p.id === projectId)?.name || "?",
      activityCount: count,
    }));

  const projectUsers = await db
    .select({ projectId: projectTask.projectId, userId: projectTaskUser.userId, userName: authUser.name, userEmail: authUser.email })
    .from(projectTaskUser)
    .innerJoin(projectTask, eq(projectTaskUser.taskId, projectTask.id))
    .innerJoin(authUser, eq(projectTaskUser.userId, authUser.id))
    .where(eq(authUser.isActive, true));

  const usersByProject: Record<string, Map<string, { id: string; name: string; email: string }>> = {};
  for (const u of projectUsers) {
    if (!usersByProject[u.projectId]) usersByProject[u.projectId] = new Map();
    usersByProject[u.projectId].set(u.userId, { id: u.userId, name: u.userName, email: u.userEmail });
  }

  const projectsWithProgress = projectsInPeriod.map((p) => {
    const projectTasks = tasksInPeriod.filter((t) => t.projectId === p.id);
    const done = projectTasks.filter((t) => t.status === "done").length;
    const progress = projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0;
    const users = usersByProject[p.id] ? Array.from(usersByProject[p.id].values()) : [];
    return { id: p.id, name: p.name, description: p.description, progress, status: p.status, priority: p.priority, users };
  });

  const avgProgress = projectsWithProgress.length > 0 ? projectsWithProgress.reduce((s, p) => s + p.progress, 0) / projectsWithProgress.length : 0;

  return {
    summary: {
      totalProjects: projectsInPeriod.length,
      totalActivities: activitiesInPeriod.length,
      totalTasks: tasksInPeriod.length,
      activeUsers: activeUsers.length,
      avgProgress: Math.round(avgProgress),
    },
    projectsByStatus,
    projectsByPriority,
    tasksByStatus,
    mostActiveProjects,
    projectsWithProgress,
    period: { start, end },
  };
}
