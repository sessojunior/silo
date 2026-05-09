#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { chromium, expect } from "@playwright/test";

dotenv.config();

const DEFAULT_WEB_ORIGIN = "http://localhost:3000";
const DEFAULT_API_ORIGIN = "http://localhost:3001";
const DEFAULT_BASE_PATH = "/silo";

const argv = process.argv.slice(2);

function getOption(name) {
  const index = argv.indexOf(name);
  if (index !== -1) {
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) return value;
  }

  const inlinePrefix = `${name}=`;
  const inlineArg = argv.find((arg) => arg.startsWith(inlinePrefix));
  if (!inlineArg) return undefined;

  const value = inlineArg.slice(inlinePrefix.length);
  return value.length > 0 ? value : undefined;
}

function hasFlag(name) {
  return argv.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function normalizeBasePath(value) {
  const trimmedValue = (value ?? "").trim();
  if (!trimmedValue) return DEFAULT_BASE_PATH;
  if (trimmedValue === "/") return "";

  const normalizedValue = trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
  return normalizedValue.length > 1 ? normalizedValue.replace(/\/$/, "") : normalizedValue;
}

function shouldRunCheck(name) {
  return onlyPages.size === 0 || onlyPages.has(name);
}

function parseAuthSetCookieHeader(setCookieHeader) {
  return setCookieHeader
    .split(/, (?=better-auth\.)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [pair] = cookie.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) return null;

      return {
        name: pair.slice(0, separatorIndex).trim(),
        value: pair.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((cookie) => cookie !== null);
}

async function blockFontRequests(context) {
  await context.addCookies([
    {
      url: webRouteBaseUrl,
      name: "silo_smoke_mode",
      value: "1",
    },
  ]);
  await context.addInitScript(() => {
    window.__SILO_SMOKE_MODE__ = true;
    window.__siloSkipLoginIntroOnce = true;
  });
  await context.route(/\.(?:woff2?|ttf|otf)(?:\?.*)?$/i, (route) => route.abort());
}

async function signInInBrowser(page, routeBasePath, userEmail, userPassword) {
  const response = await fetch(`${webRouteBaseUrl}/api/auth/login/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: userEmail, password: userPassword }),
  });

  if (!response.ok) {
    let errorMessage = `Falha ao autenticar: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload && typeof payload === "object") {
        const typedPayload = payload;
        const message = typeof typedPayload.message === "string" ? typedPayload.message : "";
        const error = typeof typedPayload.error === "string" ? typedPayload.error : "";
        errorMessage = message || error || errorMessage;
      }
    } catch {
      // Mantém a mensagem padrão quando o corpo não é JSON válido.
    }

    throw new Error(errorMessage);
  }

  const setCookieHeader = response.headers.get("set-cookie") ?? "";
  const authCookies = parseAuthSetCookieHeader(setCookieHeader);
  assert.ok(authCookies.length > 0, "Login não retornou cookies de sessão.");

  await page.context().addCookies(
    authCookies.map((cookie) => ({
      url: webRouteBaseUrl,
      name: cookie.name,
      value: cookie.value,
    })),
  );
}

async function saveScreenshot(page, outputDir, filename) {
  const screenshotPath = path.join(outputDir, `${filename}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 120000, animations: "disabled" });
  return screenshotPath;
}

async function runPageCheck(page, outputDir, check, routeBasePath) {
  await page.goto(`${routeBasePath}${check.path}`, { waitUntil: "domcontentloaded" });

  if (check.waitFor) {
    await check.waitFor(page, routeBasePath);
  }

  if (check.heading) {
    await expect(page.getByRole("heading", { name: check.heading })).toBeVisible({ timeout: 30000 });
  }

  if (check.secondary) {
    await expect(page.getByText(check.secondary)).toBeVisible({ timeout: 30000 });
  }

  const screenshotPath = await saveScreenshot(page, outputDir, check.screenshot);
  console.log(`✓ ${check.name}`);
  console.log(`  screenshot: ${screenshotPath}`);
}

async function openFirstProjectDetails(page, routeBasePath) {
  await page.goto(`${routeBasePath}/admin/projects`, { waitUntil: "domcontentloaded" });

  await expect(
    page.locator("main").getByText("Sistema de Monitoramento Meteorológico", { exact: true }).first(),
  ).toBeVisible({ timeout: 60000 });

  const projectRow = page
    .locator('main h3', { hasText: "Sistema de Monitoramento Meteorológico" })
    .first()
    .locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
  const firstProjectButton = projectRow.getByTitle("Visualizar projeto");
  await expect(firstProjectButton).toBeVisible({ timeout: 15000 });
  await firstProjectButton.click();

  await page.waitForURL(
    (url) => {
      const pathname = url.pathname;
      return (
        pathname.startsWith(`${routeBasePath}/admin/projects/`) &&
        pathname !== `${routeBasePath}/admin/projects`
      );
    },
    { timeout: 15000 },
  );
}

async function openFirstProjectKanban(page, routeBasePath) {
  const kanbanButton = page.locator('button[title="Abrir Kanban"]').first();
  await expect(kanbanButton).toBeVisible({ timeout: 60000 });
  await kanbanButton.click({ force: true });

  await page.waitForURL(
    (url) => {
      const pathname = url.pathname;
      return (
        pathname.startsWith(`${routeBasePath}/admin/projects/`) &&
        pathname.includes("/activities/")
      );
    },
    { timeout: 60000 },
  );
}

async function openFirstChatConversation(page, type) {
  const searchPlaceholder =
    type === "group"
      ? "Procurar conversas em grupos..."
      : "Procurar conversas com usuários...";
  const conversationLabel = type === "group" ? "Grupo" : "Conversa privada";
  const emptyStateMatcher =
    type === "group"
      ? /Nenhum grupo (encontrado|disponível)/
      : /Nenhum usuário (encontrado|disponível)/;

  const sidebarToggle = page.getByRole("button", {
    name: /Exibir menu lateral|Exibir ou ocultar menu lateral/,
  });
  if (await sidebarToggle.isVisible().catch(() => false)) {
    await sidebarToggle.click({ timeout: 15000 });
  }

  const tabButton = page.getByRole("button", {
    name: type === "group" ? /^Grupos/ : /^Usuários/,
  });
  await expect(tabButton).toBeVisible({ timeout: 60000 });
  await tabButton.click({ timeout: 60000 });

  await expect(page.getByPlaceholder(searchPlaceholder)).toBeVisible({ timeout: 60000 });

  const firstConversationButton = page.locator("button").filter({ has: page.locator("h3") }).first();
  const emptyState = page.getByText(emptyStateMatcher);
  await expect(firstConversationButton.or(emptyState)).toBeVisible({ timeout: 60000 });

  if (await emptyState.isVisible().catch(() => false)) {
    await expect(emptyState).toBeVisible({ timeout: 15000 });
    return;
  }

  const conversationName = (await firstConversationButton.locator("h3").textContent())?.trim() ?? "";
  assert.ok(conversationName, `Não foi possível identificar a primeira conversa de ${type === "group" ? "grupo" : "usuário"}.`);

  await firstConversationButton.click();

  await expect(page.getByPlaceholder("Digite sua mensagem...")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(conversationLabel, { exact: true })).toBeVisible({ timeout: 15000 });
}

async function openSmartMetas(page) {
  const metasButton = page.getByRole("button", { name: "Metas" });
  await expect(metasButton).toBeVisible({ timeout: 120000 });
  await metasButton.click({ timeout: 120000 });
  await expect(page.getByRole("heading", { name: "Metas SMART" })).toBeVisible({ timeout: 30000 });
}

async function setReportPeriodToCustom(page) {
  const periodButton = page.getByRole("button", { name: /Últimos 30 dias/ }).first();
  await expect(periodButton).toBeVisible({ timeout: 15000 });
  await periodButton.click({ timeout: 15000 });

  const customOption = page.getByRole("option", { name: /Personalizado/ }).first();
  await expect(customOption).toBeVisible({ timeout: 15000 });
  await customOption.click({ timeout: 15000 });
}

async function openFirstDashboardProductCalendar(page, routeBasePath) {
  await reloadPage(page, routeBasePath, "/admin/dashboard");

  const sidebarToggle = page.getByRole("button", {
    name: /Exibir menu lateral|Exibir ou ocultar menu lateral/,
  });
  if (await sidebarToggle.isVisible().catch(() => false)) {
    await sidebarToggle.click({ timeout: 15000 });
  }

  const overviewButton = page.getByRole("button", { name: "Visão geral" });
  await expect(overviewButton).toBeVisible({ timeout: 30000 });
  await overviewButton.click({ timeout: 30000 });

  const timelineTrigger = page.locator("main div.rounded-lg.bg-zinc-100").first();
  await expect(timelineTrigger).toBeVisible({ timeout: 60000 });
  await timelineTrigger.click({ timeout: 60000 });

  await expectModalHeadingVisible(page, "Mapa de status dos últimos 3 meses de", 30000);
}

async function reloadPage(page, routeBasePath, path) {
  await page.goto(`${routeBasePath}${path}`, { waitUntil: "domcontentloaded" });
}

async function clickFirstRowAction(page, buttonTitle) {
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 15000 });
  await firstRow.hover();

  const actionButton = firstRow.locator(`button[title="${buttonTitle}"]`).first();
  await expect(actionButton).toBeVisible({ timeout: 15000 });
  await actionButton.click();
}

async function expectDialogTextVisible(page, text, timeout = 15000) {
  await expect(page.getByRole("dialog").getByText(text, { exact: true })).toBeVisible({ timeout });
}

async function expectModalHeadingVisible(page, text, timeout = 15000) {
  await expect(page.locator("h3", { hasText: text })).toBeVisible({ timeout });
}

async function runInventory() {
  console.log("Visual smoke inventory");
  console.log(`- Base URL do web: ${webRouteBaseUrl}`);
  console.log(`- Base URL da API: ${apiBaseUrl}`);
  console.log("- Auth mobile: /login, /register, /login-email, /forget-password, /setup-password");
  console.log("- Admin desktop: /admin/welcome, /admin/dashboard, /admin/dashboard (registro/histórico de turno), /admin/settings, /admin/settings/products, /admin/projects, /admin/projects/:projectId, /admin/projects/:projectId/activities/:activityId, /admin/products/:slug, /admin/products/:slug/problems, /admin/products/:slug/data-flow, /admin/groups, /admin/groups/users, /admin/contacts, /admin/monitoring, /admin/chat/groups, /admin/chat/users, /admin/chat/groups/:groupId, /admin/chat/users/:userId, /admin/help, /admin/reports/availability, /admin/reports/problems, /admin/reports/projects");
  console.log("- CRUDs visuais: criação, edição, exclusão e gerenciamento de projetos, atividades, produtos, grupos, dependências, problemas, categorias, soluções, radares e contatos");
}

const webOrigin = (getOption("--web-origin") ?? process.env.WEB_VISUAL_WEB_ORIGIN ?? process.env.APP_URL_DEV ?? DEFAULT_WEB_ORIGIN).trim();
const apiOrigin = (getOption("--api-origin") ?? process.env.WEB_VISUAL_API_ORIGIN ?? process.env.API_SMOKE_BASE_URL ?? DEFAULT_API_ORIGIN).trim();
const basePath = normalizeBasePath(getOption("--base-path") ?? process.env.WEB_VISUAL_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? DEFAULT_BASE_PATH);
const webOriginUrl = webOrigin.replace(/\/$/, "");
const webRouteBaseUrl = (getOption("--web-base-url") ?? process.env.WEB_VISUAL_BASE_URL ?? `${webOriginUrl}${basePath}`).replace(/\/$/, "");
const apiBaseUrl = (getOption("--api-base-url") ?? process.env.WEB_VISUAL_API_BASE_URL ?? apiOrigin).replace(/\/$/, "");
const screenshotDir = path.resolve(getOption("--screenshot-dir") ?? process.env.WEB_VISUAL_SCREENSHOT_DIR ?? path.join(process.cwd(), ".visual-smoke"));
const inventoryOnly = hasFlag("--inventory") || (process.env.WEB_VISUAL_INVENTORY ?? "").toLowerCase() === "true";
const onlyPages = new Set(
  (getOption("--only") ?? process.env.WEB_VISUAL_ONLY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const email = getOption("--email") ?? process.env.WEB_VISUAL_EMAIL ?? process.env.API_SMOKE_EMAIL;
const password = getOption("--password") ?? process.env.WEB_VISUAL_PASSWORD ?? process.env.API_SMOKE_PASSWORD;
const cookieOverride = getOption("--cookie") ?? process.env.WEB_VISUAL_COOKIE ?? process.env.API_SMOKE_COOKIE;

const mobileAuthPages = [
  { name: "login", path: "/login", screenshot: "mobile-login" },
  { name: "register", path: "/register", screenshot: "mobile-register" },
  { name: "login-email", path: "/login-email", screenshot: "mobile-login-email" },
  { name: "forget-password", path: "/forget-password", screenshot: "mobile-forget-password" },
  { name: "setup-password", path: "/setup-password", screenshot: "mobile-setup-password" },
];

const desktopAdminPages = [
  { name: "welcome", path: "/admin/welcome", screenshot: "desktop-welcome" },
  { name: "dashboard", path: "/admin/dashboard", screenshot: "desktop-dashboard" },
  {
    name: "settings",
    path: "/admin/settings",
    screenshot: "desktop-settings",
  },
  {
    name: "projects",
    path: "/admin/projects",
    heading: "Projetos ativos",
    secondary: "Novo projeto",
    screenshot: "desktop-projects",
  },
  {
    name: "groups",
    path: "/admin/groups",
    secondary: "Total de Grupos",
    screenshot: "desktop-groups",
  },
  {
    name: "contacts",
    path: "/admin/contacts",
    secondary: "Total de Contatos",
    screenshot: "desktop-contacts",
  },
  {
    name: "products",
    path: "/admin/settings/products",
    waitFor: async (page) => {
      await expect(page.getByRole("button", { name: "Novo produto" })).toBeVisible({ timeout: 60000 });
      await expect(page.getByRole("heading", { name: /^Produtos \(/ })).toBeVisible({ timeout: 60000 });
    },
    screenshot: "desktop-products",
  },
  {
    name: "monitoring",
    path: "/admin/monitoring",
    heading: "Radares",
    secondary: "Acompanhe o estado atual dos radares por grupo e identifique",
    screenshot: "desktop-monitoring",
  },
  {
    name: "groups-users",
    path: "/admin/groups/users",
    secondary: "Total de Usuários",
    screenshot: "desktop-groups-users",
  },
  {
    name: "help-editor",
    path: "/admin/help",
    waitFor: async (page) => {
      const editHelpButton = page.getByRole("button", { name: "Editar ajuda" });
      await expect(editHelpButton).toBeVisible({ timeout: 30000 });
      await editHelpButton.click({ timeout: 30000 });
      await expectDialogTextVisible(page, "Editor da Ajuda", 30000);
    },
    screenshot: "desktop-help-editor",
  },
  {
    name: "report-smart-metas",
    path: "/admin/reports/availability",
    useFreshPage: true,
    waitFor: async (page) => {
      await openSmartMetas(page);
      await expect(page.getByRole("heading", { name: "Metas SMART" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Específico" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Mensurável" })).toBeVisible({ timeout: 15000 });
    },
    screenshot: "desktop-report-smart-metas",
  },
];

async function main() {
  if (inventoryOnly) {
    await runInventory();
    return;
  }

  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const mobileContext = await browser.newContext({
      baseURL: webOriginUrl,
      viewport: { width: 390, height: 844 },
      colorScheme: "light",
      locale: "pt-BR",
      deviceScaleFactor: 1,
    });
    await blockFontRequests(mobileContext);

    const mobilePage = await mobileContext.newPage();
    for (const check of mobileAuthPages) {
        if (!shouldRunCheck(check.name)) continue;
      await runPageCheck(mobilePage, screenshotDir, check, basePath);
    }
    await mobileContext.close();

    const desktopContextOptions = {
      baseURL: webOriginUrl,
      viewport: { width: 1440, height: 1200 },
      colorScheme: "light",
      locale: "pt-BR",
      deviceScaleFactor: 1,
    };

    const createFreshAuthenticatedPage = async () => {
      const freshContext = await browser.newContext(desktopContextOptions);
      await blockFontRequests(freshContext);
      const freshPage = await freshContext.newPage();

      if (cookieOverride) {
        const overrideCookies = cookieOverride
          .split(";")
          .map((cookie) => cookie.trim())
          .filter(Boolean)
          .map((cookie) => {
            const equalsIndex = cookie.indexOf("=");
            if (equalsIndex <= 0) return null;
            return {
              url: webRouteBaseUrl,
              name: cookie.slice(0, equalsIndex).trim(),
              value: cookie.slice(equalsIndex + 1).trim(),
            };
          })
          .filter(Boolean);

        await freshContext.addCookies(overrideCookies);
      } else {
        const desktopCookies = await desktopContext.cookies();
        const sessionCookies = desktopCookies.filter((cookie) =>
          cookie.name.startsWith("better-auth.session_"),
        );
        assert.ok(sessionCookies.length > 0, "Login administrativo não persistiu cookies de sessão no navegador.");
        await freshContext.addCookies(
          sessionCookies.map((cookie) => ({
            url: webRouteBaseUrl,
            name: cookie.name,
            value: cookie.value,
          })),
        );
      }

      return { freshContext, freshPage };
    };

    const desktopContext = await browser.newContext(desktopContextOptions);
    await blockFontRequests(desktopContext);

    const desktopPage = await desktopContext.newPage();
    if (cookieOverride) {
      const overrideCookies = cookieOverride
        .split(";")
        .map((cookie) => cookie.trim())
        .filter(Boolean)
        .map((cookie) => {
          const equalsIndex = cookie.indexOf("=");
          if (equalsIndex <= 0) return null;
          return {
            url: webRouteBaseUrl,
            name: cookie.slice(0, equalsIndex).trim(),
            value: cookie.slice(equalsIndex + 1).trim(),
          };
        })
        .filter(Boolean);

      await desktopContext.addCookies(overrideCookies);
    } else {
      await signInInBrowser(desktopPage, basePath, email, password);
    }

    for (const check of desktopAdminPages) {
      if (!shouldRunCheck(check.name)) continue;
      if (check.useFreshContext) {
        const isolatedContext = await browser.newContext(desktopContextOptions);
        await blockFontRequests(isolatedContext);
        try {
          const isolatedPage = await isolatedContext.newPage();
          if (cookieOverride) {
            const overrideCookies = cookieOverride
              .split(";")
              .map((cookie) => cookie.trim())
              .filter(Boolean)
              .map((cookie) => {
                const equalsIndex = cookie.indexOf("=");
                if (equalsIndex <= 0) return null;
                return {
                  url: webRouteBaseUrl,
                  name: cookie.slice(0, equalsIndex).trim(),
                  value: cookie.slice(equalsIndex + 1).trim(),
                };
              })
              .filter(Boolean);

            await isolatedContext.addCookies(overrideCookies);
          } else {
            const desktopCookies = await desktopContext.cookies();
            const sessionCookies = desktopCookies.filter((cookie) =>
              cookie.name.startsWith("better-auth.session_"),
            );
            assert.ok(sessionCookies.length > 0, "Login administrativo não persistiu cookies de sessão no navegador.");
            await isolatedContext.addCookies(
              sessionCookies.map((cookie) => ({
                url: webRouteBaseUrl,
                name: cookie.name,
                value: cookie.value,
              })),
            );
          }

          if (check.useFreshPage) {
            await runPageCheck(isolatedPage, screenshotDir, check, basePath);
          } else {
            await runPageCheck(isolatedPage, screenshotDir, check, basePath);
          }
        } finally {
          await isolatedContext.close();
        }
        continue;
      }
      if (check.useFreshPage) {
        const freshPage = await desktopContext.newPage();
        try {
          await runPageCheck(freshPage, screenshotDir, check, basePath);
        } finally {
          await freshPage.close();
        }
      } else {
        await runPageCheck(desktopPage, screenshotDir, check, basePath);
      }
    }

    if (shouldRunCheck("chat-shell")) {
      const chatShellPage = await desktopContext.newPage();
      try {
        await runPageCheck(
          chatShellPage,
          screenshotDir,
          {
            name: "chat-shell",
            path: "/admin/chat/groups",
            screenshot: "desktop-chat-shell",
          },
          basePath,
        );
      } finally {
        await chatShellPage.close();
      }
    }

    if (shouldRunCheck("dashboard-turn-record")) {
      const { freshContext: dashboardTurnRecordContext, freshPage: dashboardTurnRecordPage } = await createFreshAuthenticatedPage();
      try {
        await runPageCheck(
          dashboardTurnRecordPage,
          screenshotDir,
          {
            name: "dashboard-turn-record",
            path: "/admin/dashboard",
            waitFor: async (page) => {
              await expect(page.locator("main")).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-dashboard-turn-record",
          },
          basePath,
        );
      } finally {
        await dashboardTurnRecordContext.close();
      }
    }

    if (shouldRunCheck("dashboard-turn-history")) {
      const { freshContext: dashboardTurnHistoryContext, freshPage: dashboardTurnHistoryPage } = await createFreshAuthenticatedPage();
      try {
        await runPageCheck(
          dashboardTurnHistoryPage,
          screenshotDir,
          {
            name: "dashboard-turn-history",
            path: "/admin/dashboard",
            waitFor: async (page) => {
              await expect(page.locator("main")).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-dashboard-turn-history",
          },
          basePath,
        );
      } finally {
        await dashboardTurnHistoryContext.close();
      }
    }

    if (shouldRunCheck("project-create")) {
      const { freshContext: projectCreateContext, freshPage: projectCreatePage } = await createFreshAuthenticatedPage();
      try {
        await runPageCheck(
          projectCreatePage,
          screenshotDir,
          {
            name: "project-create",
            path: "/admin/projects",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/projects");
              const createButton = page.locator("main").getByRole("button", { name: "Novo projeto" });
              await expect(createButton).toBeVisible({ timeout: 120000 });
              await createButton.click({ timeout: 120000 });
              await expectDialogTextVisible(page, "Novo Projeto", 120000);
            },
            screenshot: "desktop-project-create",
          },
          basePath,
        );
      } finally {
        await projectCreateContext.close();
      }
    }

    if (
      shouldRunCheck("project-create") ||
      shouldRunCheck("project-edit") ||
      shouldRunCheck("project-delete")
    ) {
      if (shouldRunCheck("project-edit")) {
        const { freshContext: projectEditContext, freshPage: projectEditPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectEditPage,
            screenshotDir,
            {
              name: "project-edit",
              path: "/admin/projects",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/projects");
                await expect(page.getByRole("button", { name: "Novo projeto" })).toBeVisible({ timeout: 120000 });
                await expect(
                  page.locator("main").getByText("Sistema de Monitoramento Meteorológico", { exact: true }).first(),
                ).toBeVisible({ timeout: 120000 });
                const editButton = page.locator('main button[title="Editar projeto"]').first();
                await expect(editButton).toBeVisible({ timeout: 120000 });
                await editButton.click({ timeout: 120000 });
                await expectDialogTextVisible(page, "Editar Projeto", 120000);
              },
              screenshot: "desktop-project-edit",
            },
            basePath,
          );
        } finally {
          await projectEditContext.close();
        }
      }

      if (shouldRunCheck("project-delete")) {
        const { freshContext: projectDeleteContext, freshPage: projectDeletePage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectDeletePage,
            screenshotDir,
            {
              name: "project-delete",
              path: "/admin/projects",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/projects");
                await expect(page.getByRole("button", { name: "Novo projeto" })).toBeVisible({ timeout: 120000 });
                await expect(
                  page.locator("main").getByText("Sistema de Monitoramento Meteorológico", { exact: true }).first(),
                ).toBeVisible({ timeout: 120000 });
                const editButton = page.locator('main button[title="Editar projeto"]').first();
                await expect(editButton).toBeVisible({ timeout: 120000 });
                await editButton.click({ timeout: 120000 });
                const editDialog = page.getByRole("dialog", { name: "Editar Projeto" });
                await expect(editDialog).toBeVisible({ timeout: 120000 });
                await editDialog.getByRole("button", { name: "Excluir", exact: true }).click({ timeout: 120000 });
                await expectDialogTextVisible(page, "Confirmar exclusão", 120000);
              },
              screenshot: "desktop-project-delete",
            },
            basePath,
          );
        } finally {
          await projectDeleteContext.close();
        }
      }
    }

    if (
      shouldRunCheck("project-details") ||
      shouldRunCheck("project-activity-create") ||
      shouldRunCheck("project-activity-edit") ||
      shouldRunCheck("project-kanban")
    ) {
      const { freshContext: projectDetailBootstrapContext, freshPage: projectDetailBootstrapPage } =
        await createFreshAuthenticatedPage();

      await openFirstProjectDetails(projectDetailBootstrapPage, basePath);
      const projectDetailPath = new URL(projectDetailBootstrapPage.url()).pathname.replace(
        new RegExp(`^${basePath}`),
        "",
      );
      await projectDetailBootstrapContext.close();

      if (shouldRunCheck("project-details")) {
        const { freshContext: projectDetailsContext, freshPage: projectDetailsPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectDetailsPage,
            screenshotDir,
            {
              name: "project-details",
              path: projectDetailPath,
              waitFor: async (page) => {
                await expect(page.getByRole("button", { name: "Nova atividade" })).toBeVisible({ timeout: 30000 });
              },
              screenshot: "desktop-project-details",
            },
            basePath,
          );
        } finally {
          await projectDetailsContext.close();
        }
      }

      if (shouldRunCheck("project-activity-create")) {
        const { freshContext: projectActivityCreateContext, freshPage: projectActivityCreatePage } =
          await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectActivityCreatePage,
            screenshotDir,
            {
              name: "project-activity-create",
              path: projectDetailPath,
              waitFor: async (page) => {
                const createButton = page.getByRole("button", { name: "Nova atividade" });
                await expect(createButton).toBeVisible({ timeout: 120000 });
                await createButton.click({ timeout: 15000 });
                await expectDialogTextVisible(page, "Nova Atividade", 30000);
              },
              screenshot: "desktop-project-activity-create",
            },
            basePath,
          );
        } finally {
          await projectActivityCreateContext.close();
        }
      }

      if (shouldRunCheck("project-activity-edit")) {
        const { freshContext: projectActivityEditContext, freshPage: projectActivityEditPage } =
          await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectActivityEditPage,
            screenshotDir,
            {
              name: "project-activity-edit",
              path: projectDetailPath,
              waitFor: async (page) => {
                const editButton = page.locator('button[title="Editar atividade"]').first();
                await expect(editButton).toBeVisible({ timeout: 30000 });
                await editButton.click({ timeout: 15000 });
                await expectDialogTextVisible(page, "Editar Atividade", 30000);
              },
              screenshot: "desktop-project-activity-edit",
            },
            basePath,
          );
        } finally {
          await projectActivityEditContext.close();
        }
      }

      if (shouldRunCheck("project-kanban")) {
        const { freshContext: projectKanbanContext, freshPage: projectKanbanPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            projectKanbanPage,
            screenshotDir,
            {
              name: "project-kanban",
              path: projectDetailPath,
              waitFor: async (page, routeBasePath) => {
                await openFirstProjectKanban(page, routeBasePath);
                await expect(page.getByText("A fazer", { exact: true }).first()).toBeVisible({ timeout: 120000 });
              },
              screenshot: "desktop-project-kanban",
            },
            basePath,
          );
        } finally {
          await projectKanbanContext.close();
        }
      }
    }

    if (
      shouldRunCheck("group-create") ||
      shouldRunCheck("group-edit") ||
      shouldRunCheck("group-delete") ||
      shouldRunCheck("group-permissions") ||
      shouldRunCheck("group-users")
    ) {
      const runFreshGroupCheck = async (name, screenshot, waitFor) => {
        const { freshContext, freshPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            freshPage,
            screenshotDir,
            {
              name,
              path: "/admin/groups",
              waitFor,
              screenshot,
            },
            basePath,
          );
        } finally {
          await freshContext.close();
        }
      };

      if (shouldRunCheck("group-create")) {
        await runFreshGroupCheck("group-create", "desktop-group-create", async (page) => {
          const createButton = page.getByRole("button", { name: "Novo grupo" });
          await expect(createButton).toBeVisible({ timeout: 30000 });
          await createButton.click({ timeout: 30000 });
          await expectDialogTextVisible(page, "Novo Grupo", 30000);
        });
      }

      if (shouldRunCheck("group-permissions")) {
        await runFreshGroupCheck("group-permissions", "desktop-group-permissions", async (page) => {
          const permissionsButton = page.locator('button[title="Permissões do Grupo"]').first();
          await expect(permissionsButton).toBeVisible({ timeout: 30000 });
          await permissionsButton.click({ timeout: 30000 });
          await expectDialogTextVisible(page, "Permissões do grupo", 30000);
          await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 30000 });
        });
      }

      if (shouldRunCheck("group-users")) {
        await runFreshGroupCheck("group-users", "desktop-group-users", async (page) => {
          const usersButton = page.locator('button[title="Gerenciar Usuários"]').first();
          await expect(usersButton).toBeVisible({ timeout: 30000 });
          await usersButton.click({ timeout: 30000 });
          await expectDialogTextVisible(page, "Gerenciar Usuários", 30000);
          await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 30000 });
        });
      }

      if (shouldRunCheck("group-edit")) {
        await runFreshGroupCheck("group-edit", "desktop-group-edit", async (page) => {
          await clickFirstRowAction(page, "Editar Grupo");
          await expectDialogTextVisible(page, "Editar Grupo", 30000);
        });
      }

      if (shouldRunCheck("group-delete")) {
        await runFreshGroupCheck("group-delete", "desktop-group-delete", async (page) => {
          const deleteButton = page.locator('button[title="Excluir Grupo"]').first();
          await expect(deleteButton).toBeVisible({ timeout: 30000 });
          await deleteButton.click({ timeout: 30000 });
          await expectDialogTextVisible(page, "Confirmar exclusão", 30000);
        });
      }
    }

    if (
      shouldRunCheck("product-create") ||
      shouldRunCheck("product-edit") ||
      shouldRunCheck("product-delete")
    ) {
      if (shouldRunCheck("product-create")) {
        const productCreatePage = await desktopContext.newPage();
        try {
        await runPageCheck(
          productCreatePage,
          screenshotDir,
          {
            name: "product-create",
            path: "/admin/settings/products",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/settings/products");
              const createButton = page.getByRole("button", { name: "Novo produto" });
              await expect(createButton).toBeVisible({ timeout: 60000 });
              await createButton.click({ timeout: 60000 });
              await expectDialogTextVisible(page, "Novo Produto", 30000);
            },
            screenshot: "desktop-product-create",
          },
          basePath,
        );
        } finally {
          await productCreatePage.close();
        }
      }

      if (shouldRunCheck("product-edit")) {
        const productEditPage = await desktopContext.newPage();
        try {
        await runPageCheck(
          productEditPage,
          screenshotDir,
          {
            name: "product-edit",
            path: "/admin/settings/products",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/settings/products");
              const editButton = page.locator('button[title="Editar produto"]').first();
              await expect(editButton).toBeVisible({ timeout: 60000 });
              await editButton.click({ timeout: 60000 });
              await expectDialogTextVisible(page, "Editar Produto", 30000);
            },
            screenshot: "desktop-product-edit",
          },
          basePath,
        );
        } finally {
          await productEditPage.close();
        }
      }

      if (shouldRunCheck("product-delete")) {
        const productDeletePage = await desktopContext.newPage();
        try {
        await runPageCheck(
          productDeletePage,
          screenshotDir,
          {
            name: "product-delete",
            path: "/admin/settings/products",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/settings/products");
              const deleteButton = page.locator('button[title="Excluir produto"]').first();
              await expect(deleteButton).toBeVisible({ timeout: 60000 });
              await deleteButton.click({ timeout: 60000 });
              await expectDialogTextVisible(page, "Confirmar exclusão", 30000);
            },
            screenshot: "desktop-product-delete",
          },
          basePath,
        );
        } finally {
          await productDeletePage.close();
        }
      }
    }

    if (shouldRunCheck("monitoring-management") || shouldRunCheck("monitoring-new-group") || shouldRunCheck("monitoring-new-radar")) {
      if (shouldRunCheck("monitoring-management")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "monitoring-management",
            path: "/admin/monitoring",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/monitoring");
              await page.getByRole("button", { name: "Gerenciar grupos e webhooks" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Gerenciar Radares", 30000);
              await expect(page.getByRole("button", { name: "Novo Grupo" })).toBeVisible({ timeout: 15000 });
              await expect(page.getByRole("button", { name: "Novo radar" }).first()).toBeVisible({ timeout: 15000 });
            },
            screenshot: "desktop-monitoring-management",
          },
          basePath,
        );
      }

      if (shouldRunCheck("monitoring-new-group")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "monitoring-new-group",
            path: "/admin/monitoring",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/monitoring");
              await page.getByRole("button", { name: "Gerenciar grupos e webhooks" }).click({ timeout: 15000 });
              await page.getByRole("button", { name: "Novo Grupo" }).click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Novo Grupo" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-monitoring-new-group",
          },
          basePath,
        );
      }

      if (shouldRunCheck("monitoring-new-radar")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "monitoring-new-radar",
            path: "/admin/monitoring",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/monitoring");
              await page.getByRole("button", { name: "Gerenciar grupos e webhooks" }).click({ timeout: 15000 });
              await page.getByRole("button", { name: "Novo radar" }).first().click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Configurar Radar" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-monitoring-new-radar",
          },
          basePath,
        );
      }
    }

    if (
      shouldRunCheck("product-details") ||
      shouldRunCheck("product-dependencies") ||
      shouldRunCheck("product-manual") ||
      shouldRunCheck("product-problems") ||
      shouldRunCheck("product-problem-create") ||
      shouldRunCheck("product-problem-edit") ||
      shouldRunCheck("product-problem-delete") ||
      shouldRunCheck("product-category-create") ||
      shouldRunCheck("product-solution-create") ||
      shouldRunCheck("product-data-flow")
    ) {
      const productPath = "/admin/products/bam";
      const runFreshProductCheck = async (name, path, screenshot, waitFor) => {
        const { freshContext, freshPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            freshPage,
            screenshotDir,
            {
              name,
              path,
              waitFor,
              screenshot,
            },
            basePath,
          );
        } finally {
          await freshContext.close();
        }
      };

      if (shouldRunCheck("product-details")) {
        await runFreshProductCheck(
          "product-details",
          productPath,
          "desktop-product-details",
          async (page) => {
            await expect(page.getByRole("heading", { name: "Contatos em caso de problemas" })).toBeVisible({
              timeout: 30000,
            });
            await expect(page.getByText("Gerenciar contatos")).toBeVisible({ timeout: 30000 });
          },
        );
      }

      if (shouldRunCheck("product-dependencies")) {
        await runFreshProductCheck(
          "product-dependencies",
          productPath,
          "desktop-product-dependencies",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, productPath);
            await page.locator('button[title="Gerenciar dependências"]').click({ timeout: 15000 });
            await expect(page.getByRole("dialog", { name: "Gerenciar Dependências" })).toBeVisible({ timeout: 30000 });
            await page.getByRole("button", { name: "Nova Dependência" }).click({ timeout: 15000 });
            await expect(page.getByRole("dialog", { name: "Adicionar Dependência" })).toBeVisible({ timeout: 30000 });
          },
        );
      }

      if (shouldRunCheck("product-manual")) {
        await runFreshProductCheck(
          "product-manual",
          productPath,
          "desktop-product-manual",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, productPath);
            await page.getByRole("button", { name: "Editar manual" }).click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Editor do Manual", 30000);
            await expect(page.getByRole("button", { name: "Salvar Manual" })).toBeVisible({ timeout: 15000 });
          },
        );
      }

      if (shouldRunCheck("product-problems")) {
        await runFreshProductCheck(
          "product-problems",
          `${productPath}/problems`,
          "desktop-product-problems",
          async (page) => {
            await expect(page.locator('button[title="Adicionar problema"]')).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole("button", { name: "Gerenciar categorias" })).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole("heading", { name: "Soluções" })).toBeVisible({ timeout: 15000 });
          },
        );
      }

      if (shouldRunCheck("product-problem-create")) {
        await runFreshProductCheck(
          "product-problem-create",
          `${productPath}/problems`,
          "desktop-product-problem-create",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, `${productPath}/problems`);
            await page.locator('button[title="Adicionar problema"]').click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Adicionar problema", 30000);
          },
        );
      }

      if (shouldRunCheck("product-problem-edit")) {
        await runFreshProductCheck(
          "product-problem-edit",
          `${productPath}/problems`,
          "desktop-product-problem-edit",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, `${productPath}/problems`);
            await page.getByRole("button", { name: "Editar problema" }).click({ timeout: 15000 });
            await expect(page.getByRole("dialog", { name: "Editar problema" })).toBeVisible({ timeout: 30000 });
          },
        );
      }

      if (shouldRunCheck("product-problem-delete")) {
        await runFreshProductCheck(
          "product-problem-delete",
          `${productPath}/problems`,
          "desktop-product-problem-delete",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, `${productPath}/problems`);
            await page.getByRole("button", { name: "Editar problema" }).click({ timeout: 15000 });
            await expect(page.getByRole("dialog", { name: "Editar problema" })).toBeVisible({ timeout: 30000 });
            await page.getByRole("button", { name: "Excluir problema" }).click({ timeout: 15000 });
            await expect(page.getByText("Tem certeza que deseja excluir este problema?")).toBeVisible({ timeout: 30000 });
          },
        );
      }

      if (shouldRunCheck("product-category-create")) {
        await runFreshProductCheck(
          "product-category-create",
          `${productPath}/problems`,
          "desktop-product-category-create",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, `${productPath}/problems`);
            await page.getByRole("button", { name: "Gerenciar categorias" }).click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Gerenciar categorias de problemas", 30000);
            await page.getByRole("button", { name: "Cadastrar categoria" }).click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Cadastrar categoria", 30000);
          },
        );
      }

      if (shouldRunCheck("product-solution-create")) {
        await runFreshProductCheck(
          "product-solution-create",
          `${productPath}/problems`,
          "desktop-product-solution-create",
          async (page, routeBasePath) => {
            await reloadPage(page, routeBasePath, `${productPath}/problems`);
            await page.getByRole("button", { name: "Adicionar solução" }).first().click({ timeout: 15000 });
            await expectModalHeadingVisible(page, "Adicionar solução", 30000);
          },
        );
      }

      if (shouldRunCheck("product-data-flow")) {
        await runFreshProductCheck(
          "product-data-flow",
          `${productPath}/data-flow`,
          "desktop-product-data-flow",
          async (page) => {
            await expect(page.locator(".data-flow-gantt-shell")).toBeVisible({ timeout: 15000 });
            await expect(page.getByText("Nome")).toBeVisible({ timeout: 15000 });
            await expect(page.getByText("Inicio")).toBeVisible({ timeout: 15000 });
            await expect(page.getByText("Fim")).toBeVisible({ timeout: 15000 });
          },
        );
      }
    }

    await desktopContext.close();

    console.log("Smoke visual concluído com sucesso.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Smoke visual falhou:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});