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
  if (index === -1) return undefined;

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function hasFlag(name) {
  return argv.includes(name);
}

function normalizeBasePath(value) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0 || trimmed === "/") return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/$/, "");
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function toBrowserCookies(setCookieHeaders, webRouteBaseUrl) {
  return setCookieHeaders
    .map((cookie) => {
      const firstPart = cookie.split(";")[0]?.trim() ?? "";
      const equalsIndex = firstPart.indexOf("=");
      if (equalsIndex <= 0) return null;

      const name = firstPart.slice(0, equalsIndex).trim();
      const value = firstPart.slice(equalsIndex + 1).trim();
      if (!name || !value) return null;

      return { url: webRouteBaseUrl, name, value };
    })
    .filter(Boolean);
}

async function signInInBrowser(page, routeBasePath, email, password) {
  assert.ok(email, "WEB_VISUAL_EMAIL ou API_SMOKE_EMAIL é obrigatório para validar as páginas administrativas.");
  assert.ok(password, "WEB_VISUAL_PASSWORD ou API_SMOKE_PASSWORD é obrigatório para validar as páginas administrativas.");

  const response = await fetch(`${apiBaseUrl}/api/auth/login/password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  assert.ok(response.ok, `Falha ao autenticar na API administrativa: ${response.status} ${response.statusText}`);

  const setCookieHeaders = getSetCookieHeaders(response.headers);
  const browserCookies = toBrowserCookies(setCookieHeaders, webRouteBaseUrl);
  assert.ok(browserCookies.length > 0, "Login administrativo não retornou cookies de sessão.");

  await page.context().addCookies(browserCookies);
  await page.goto(`${routeBasePath}/admin/dashboard`, { waitUntil: "networkidle" });

  const cookies = await page.context().cookies();
  const sessionCookies = cookies.filter((cookie) => cookie.name.startsWith("better-auth.session_"));
  assert.ok(sessionCookies.length > 0, "Login administrativo não persistiu cookies de sessão no navegador.");
}

async function saveScreenshot(page, outputDir, name) {
  const filePath = path.join(outputDir, `${name}.png`);
  await page.screenshot({
    path: filePath,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    timeout: 60000,
  });
  return filePath;
}

async function runPageCheck(page, outputDir, check, routeBasePath) {
  const expectedPath = check.path ? `${routeBasePath}${check.path}` : null;
  const currentPath = new URL(page.url()).pathname;

  if (expectedPath && currentPath !== expectedPath) {
    await page.goto(expectedPath, { waitUntil: "networkidle" });
  }

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
  await page.goto(`${routeBasePath}/admin/projects`, { waitUntil: "networkidle" });

  const firstProjectButton = page.locator('button[title="Visualizar projeto"]').first();
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
  await expect(kanbanButton).toBeVisible({ timeout: 15000 });
  await kanbanButton.click();

  await page.waitForURL(
    (url) => {
      const pathname = url.pathname;
      return (
        pathname.startsWith(`${routeBasePath}/admin/projects/`) &&
        pathname.includes("/activities/")
      );
    },
    { timeout: 15000 },
  );
}

async function getFirstProductSlug(page, routeBasePath) {
  await page.goto(`${routeBasePath}/admin/settings/products`, { waitUntil: "networkidle" });

  const firstSlugCell = page.locator("tbody tr td .font-mono").first();
  await expect(firstSlugCell).toBeVisible({ timeout: 15000 });

  const slug = (await firstSlugCell.textContent())?.trim() ?? "";
  assert.ok(slug, "Não foi possível identificar o slug do primeiro produto.");
  return slug;
}

async function openFirstChatConversation(page, type) {
  const searchPlaceholder =
    type === "group"
      ? "Procurar conversas em grupos..."
      : "Procurar conversas com usuários...";
  const conversationLabel = type === "group" ? "Grupo" : "Conversa privada";

  const sidebarToggle = page.getByRole("button", {
    name: /Exibir menu lateral|Exibir ou ocultar menu lateral/,
  });
  if (await sidebarToggle.isVisible().catch(() => false)) {
    await sidebarToggle.click({ timeout: 15000 });
  }

  const tabButton = page.getByRole("button", {
    name: type === "group" ? /^Grupos/ : /^Usuários/,
  });
  await expect(tabButton).toBeVisible({ timeout: 15000 });
  await tabButton.click({ timeout: 15000 });

  await expect(page.getByPlaceholder(searchPlaceholder)).toBeVisible({ timeout: 15000 });

  const firstConversationButton = page.locator("button").filter({ has: page.locator("h3") }).first();
  await expect(firstConversationButton).toBeVisible({ timeout: 60000 });

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

  const productCard = page.locator('div.rounded-lg.border-dashed').first();
  await expect(productCard).toBeVisible({ timeout: 15000 });

  const timelineTrigger = productCard.locator('div.rounded-lg.bg-zinc-100').first();
  await expect(timelineTrigger).toBeVisible({ timeout: 15000 });
  await timelineTrigger.click({ timeout: 15000 });

  await expectModalHeadingVisible(page, "Mapa de status dos últimos 3 meses de", 30000);
}

async function reloadPage(page, routeBasePath, path) {
  await page.goto(`${routeBasePath}${path}`, { waitUntil: "networkidle" });
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

const shouldRunCheck = (name) => onlyPages.size === 0 || onlyPages.has(name);

const mobileAuthPages = [
  { name: "login", path: "/login", heading: "Entrar", screenshot: "mobile-login" },
  { name: "register", path: "/register", heading: "Criar conta", screenshot: "mobile-register" },
  { name: "login-email", path: "/login-email", heading: "Acessar com e-mail", screenshot: "mobile-login-email" },
  { name: "forget-password", path: "/forget-password", heading: "Esqueceu a senha", screenshot: "mobile-forget-password" },
  { name: "setup-password", path: "/setup-password", heading: "Definir senha", screenshot: "mobile-setup-password" },
];

const desktopAdminPages = [
  {
    name: "dashboard",
    path: "/admin/dashboard",
    secondary: "Monitoramento (Fake)",
    screenshot: "desktop-dashboard",
  },
  {
    name: "welcome",
    path: "/admin/welcome",
    waitFor: async (page) => {
      await expect(page.getByRole("link", { name: "Complete seu perfil de usuário" })).toHaveAttribute(
        "href",
        /\/admin\/settings$/,
      );
      await expect(page.getByRole("link", { name: "Cadastre produtos" })).toHaveAttribute(
        "href",
        /\/admin\/settings\/products$/,
      );
    },
    heading: "Bem-vindo",
    secondary: "Vamos começar!",
    screenshot: "desktop-welcome",
  },
  {
    name: "settings-profile",
    path: "/admin/settings",
    waitFor: async (page) => {
      await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByLabel("Nome completo")).toBeVisible({ timeout: 15000 });
    },
    heading: "Informações Pessoais",
    secondary: "Salvar Alterações",
    screenshot: "desktop-settings-profile",
  },
  {
    name: "settings-preferences",
    path: "/admin/settings",
    waitFor: async (page, routeBasePath) => {
      await page.goto(`${routeBasePath}/admin/settings?tab=preferences`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Permissões Gerais" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Salvar Preferências" })).toBeVisible({ timeout: 15000 });
    },
    heading: "Permissões Gerais",
    secondary: "Salvar Preferências",
    screenshot: "desktop-settings-preferences",
  },
  {
    name: "settings-security",
    path: "/admin/settings",
    waitFor: async (page, routeBasePath) => {
      await page.goto(`${routeBasePath}/admin/settings?tab=security`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Alterar E-mail" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Alterar E-mail" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByLabel("Novo e-mail")).toBeVisible({ timeout: 15000 });
      await expect(page.getByLabel("Nova senha")).toBeVisible({ timeout: 15000 });
    },
    heading: "Alterar E-mail",
    secondary: "Informações de Segurança",
    screenshot: "desktop-settings-security",
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
      await page.getByRole("button", { name: "Editar ajuda" }).click();
      await expect(page.getByRole("dialog", { name: "Editor da Ajuda" })).toBeVisible({ timeout: 15000 });
    },
    screenshot: "desktop-help-editor",
  },
  {
    name: "chat-groups",
    path: "/admin/chat/groups",
    waitFor: async (page) => {
      await openFirstChatConversation(page, "group");
    },
    screenshot: "desktop-chat-groups",
  },
  {
    name: "chat-users",
    path: "/admin/chat/users",
    waitFor: async (page) => {
      await openFirstChatConversation(page, "user");
    },
    screenshot: "desktop-chat-users",
  },
  {
    name: "report-availability",
    path: "/admin/reports/availability",
    waitFor: async (page) => {
      await expect(page.getByText(/Filtros do Relatório de/)).toBeVisible({ timeout: 30000 });
      await setReportPeriodToCustom(page);
      await expect(page.locator('input[type="date"]')).toHaveCount(2, { timeout: 30000 });
    },
    heading: "Visualização dos Dados",
    secondary: "Total de Produtos",
    screenshot: "desktop-report-availability",
  },
  {
    name: "report-problems",
    path: "/admin/reports/problems",
    waitFor: async (page) => {
      await expect(page.getByText(/Filtros do Relatório de/)).toBeVisible({ timeout: 30000 });
      await setReportPeriodToCustom(page);
      await expect(page.locator('input[type="date"]')).toHaveCount(2, { timeout: 30000 });
    },
    heading: "Visualização dos Dados",
    secondary: "Total de Problemas",
    screenshot: "desktop-report-problems",
  },
  {
    name: "report-projects",
    path: "/admin/reports/projects",
    waitFor: async (page) => {
      await expect(page.getByText(/Filtros do Relatório de/)).toBeVisible({ timeout: 30000 });
      await setReportPeriodToCustom(page);
      await expect(page.locator('input[type="date"]')).toHaveCount(2, { timeout: 30000 });
    },
    heading: "Visualização dos Dados",
    secondary: "Total de Projetos",
    screenshot: "desktop-report-projects",
  },
  {
    name: "report-smart-metas",
    path: "/admin/reports/availability",
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

    const mobilePage = await mobileContext.newPage();
    for (const check of mobileAuthPages) {
        if (!shouldRunCheck(check.name)) continue;
      await runPageCheck(mobilePage, screenshotDir, check, basePath);
    }
    await mobileContext.close();

    const desktopContext = await browser.newContext({
      baseURL: webOriginUrl,
      viewport: { width: 1440, height: 1200 },
      colorScheme: "light",
      locale: "pt-BR",
      deviceScaleFactor: 1,
    });

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
      await runPageCheck(desktopPage, screenshotDir, check, basePath);
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
      await runPageCheck(
        desktopPage,
        screenshotDir,
        {
          name: "dashboard-turn-record",
          path: "/admin/dashboard",
          waitFor: async (page, routeBasePath) => {
            await openFirstDashboardProductCalendar(page, routeBasePath);
            const turnButton = page.locator('button[title^="Turno "]').first();
            await expect(turnButton).toBeVisible({ timeout: 15000 });
            await turnButton.click({ timeout: 15000 });
            await expect(page.getByRole("button", { name: "Histórico" })).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole("button", { name: "Enviar pendências" })).toBeVisible({ timeout: 15000 });
            await expectDialogTextVisible(page, "Editar acontecimentos no turno", 30000);
          },
          screenshot: "desktop-dashboard-turn-record",
        },
        basePath,
      );
    }

    if (shouldRunCheck("dashboard-turn-history")) {
      await runPageCheck(
        desktopPage,
        screenshotDir,
        {
          name: "dashboard-turn-history",
          path: "/admin/dashboard",
          waitFor: async (page, routeBasePath) => {
            await openFirstDashboardProductCalendar(page, routeBasePath);
            const turnButton = page.locator('button[title^="Turno "]').first();
            await expect(turnButton).toBeVisible({ timeout: 15000 });
            await turnButton.click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Editar acontecimentos no turno", 30000);
            await page.getByRole("button", { name: "Histórico" }).click({ timeout: 15000 });
            await expectDialogTextVisible(page, "Histórico de Status", 30000);
          },
          screenshot: "desktop-dashboard-turn-history",
        },
        basePath,
      );
    }

    if (
      shouldRunCheck("project-create") ||
      shouldRunCheck("project-edit") ||
      shouldRunCheck("project-delete")
    ) {
      if (shouldRunCheck("project-create")) {
        const projectCreatePage = await desktopContext.newPage();
        try {
          await runPageCheck(
            projectCreatePage,
            screenshotDir,
            {
              name: "project-create",
              path: "/admin/projects",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/projects");
                const createButton = page.getByRole("button", { name: "Novo projeto" });
                await expect(createButton).toBeVisible({ timeout: 30000 });
                await createButton.click({ timeout: 30000 });
                await expectDialogTextVisible(page, "Novo Projeto", 30000);
              },
              screenshot: "desktop-project-create",
            },
            basePath,
          );
        } finally {
          await projectCreatePage.close();
        }
      }

      if (shouldRunCheck("project-edit")) {
        const projectEditPage = await desktopContext.newPage();
        try {
          await runPageCheck(
            projectEditPage,
            screenshotDir,
            {
              name: "project-edit",
              path: "/admin/projects",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/projects");
                await expect(page.getByRole("button", { name: "Novo projeto" })).toBeVisible({ timeout: 60000 });
                const editButton = page.locator('button[title="Editar projeto"]').first();
                await expect(editButton).toBeVisible({ timeout: 60000 });
                await editButton.click({ timeout: 60000 });
                await expectDialogTextVisible(page, "Editar Projeto", 30000);
              },
              screenshot: "desktop-project-edit",
            },
            basePath,
          );
        } finally {
          await projectEditPage.close();
        }
      }

      if (shouldRunCheck("project-delete")) {
        const projectDeletePage = await desktopContext.newPage();
        try {
          await runPageCheck(
            projectDeletePage,
            screenshotDir,
            {
              name: "project-delete",
              path: "/admin/projects",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/projects");
                await expect(page.getByRole("button", { name: "Novo projeto" })).toBeVisible({ timeout: 60000 });
                const editButton = page.locator('button[title="Editar projeto"]').first();
                await expect(editButton).toBeVisible({ timeout: 60000 });
                await editButton.click({ timeout: 60000 });
                const editDialog = page.getByRole("dialog", { name: "Editar Projeto" });
                await expect(editDialog).toBeVisible({ timeout: 30000 });
                await editDialog.getByRole("button", { name: "Excluir", exact: true }).click({ timeout: 60000 });
                await expectDialogTextVisible(page, "Confirmar exclusão", 30000);
              },
              screenshot: "desktop-project-delete",
            },
            basePath,
          );
        } finally {
          await projectDeletePage.close();
        }
      }
    }

    if (
      shouldRunCheck("project-details") ||
      shouldRunCheck("project-activity-create") ||
      shouldRunCheck("project-activity-edit") ||
      shouldRunCheck("project-kanban")
    ) {
      await openFirstProjectDetails(desktopPage, basePath);
      const projectDetailPath = new URL(desktopPage.url()).pathname.replace(
        new RegExp(`^${basePath}`),
        "",
      );

      if (shouldRunCheck("project-details")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "project-details",
            waitFor: async (page) => {
              await expect(page.getByRole("button", { name: "Nova atividade" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-project-details",
          },
          basePath,
        );
      }

      if (shouldRunCheck("project-activity-create")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "project-activity-create",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, projectDetailPath);
              await page.getByRole("button", { name: "Nova atividade" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Nova Atividade", 30000);
            },
            screenshot: "desktop-project-activity-create",
          },
          basePath,
        );
      }

      if (shouldRunCheck("project-activity-edit")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "project-activity-edit",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, projectDetailPath);
              await page.locator('button[title="Editar atividade"]').first().click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Editar Atividade", 30000);
            },
            screenshot: "desktop-project-activity-edit",
          },
          basePath,
        );
      }

      if (shouldRunCheck("project-kanban")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "project-kanban",
            waitFor: async (page, routeBasePath) => {
              await openFirstProjectDetails(page, routeBasePath);
              await openFirstProjectKanban(page, routeBasePath);
              await expect(page.getByText("A fazer")).toBeVisible({ timeout: 120000 });
              await expect(page.getByText("Bloqueado")).toBeVisible({ timeout: 120000 });
              await expect(page.getByText("Em progresso")).toBeVisible({ timeout: 120000 });
              await expect(page.getByText("Em revisão")).toBeVisible({ timeout: 120000 });
              await expect(page.getByText("Concluído")).toBeVisible({ timeout: 120000 });
            },
            screenshot: "desktop-project-kanban",
          },
          basePath,
        );
      }
    }

    if (
      shouldRunCheck("group-create") ||
      shouldRunCheck("group-edit") ||
      shouldRunCheck("group-delete") ||
      shouldRunCheck("group-permissions") ||
      shouldRunCheck("group-users")
    ) {
      if (shouldRunCheck("group-create")) {
        const groupCreatePage = await desktopContext.newPage();
        try {
        await runPageCheck(
          groupCreatePage,
          screenshotDir,
          {
            name: "group-create",
            path: "/admin/groups",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/groups");
              const createButton = page.getByRole("button", { name: "Novo grupo" });
              await expect(createButton).toBeVisible({ timeout: 30000 });
              await createButton.click({ timeout: 30000 });
              await expectDialogTextVisible(page, "Novo Grupo", 30000);
            },
            screenshot: "desktop-group-create",
          },
          basePath,
        );
        } finally {
          await groupCreatePage.close();
        }
      }

      if (shouldRunCheck("group-permissions")) {
        const groupPermissionsPage = await desktopContext.newPage();
        try {
        await runPageCheck(
          groupPermissionsPage,
          screenshotDir,
          {
            name: "group-permissions",
            path: "/admin/groups",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/groups");
              const permissionsButton = page.locator('button[title="Permissões do Grupo"]').first();
              await expect(permissionsButton).toBeVisible({ timeout: 30000 });
              await permissionsButton.click({ timeout: 30000 });
              await expectDialogTextVisible(page, "Permissões do grupo", 30000);
              await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-group-permissions",
          },
          basePath,
        );
        } finally {
          await groupPermissionsPage.close();
        }
      }

      if (shouldRunCheck("group-users")) {
        const groupUsersPage = await desktopContext.newPage();
        try {
        await runPageCheck(
          groupUsersPage,
          screenshotDir,
          {
            name: "group-users",
            path: "/admin/groups",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/groups");
              const usersButton = page.locator('button[title="Gerenciar Usuários"]').first();
              await expect(usersButton).toBeVisible({ timeout: 30000 });
              await usersButton.click({ timeout: 30000 });
              await expectDialogTextVisible(page, "Gerenciar Usuários", 30000);
              await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-group-users",
          },
          basePath,
        );
        } finally {
          await groupUsersPage.close();
        }
      }

      if (shouldRunCheck("group-edit")) {
        const groupEditPage = await desktopContext.newPage();
        try {
        await runPageCheck(
          groupEditPage,
          screenshotDir,
          {
            name: "group-edit",
            path: "/admin/groups",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/groups");
              const editButton = page.locator('button[title="Editar Grupo"]').first();
              await expect(editButton).toBeVisible({ timeout: 30000 });
              await editButton.click({ timeout: 30000 });
              await expectDialogTextVisible(page, "Editar Grupo", 30000);
            },
            screenshot: "desktop-group-edit",
          },
          basePath,
        );
        } finally {
          await groupEditPage.close();
        }
      }

      if (shouldRunCheck("group-delete")) {
        const groupDeletePage = await desktopContext.newPage();
        try {
        await runPageCheck(
          groupDeletePage,
          screenshotDir,
          {
            name: "group-delete",
            path: "/admin/groups",
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, "/admin/groups");
              const deleteButton = page.locator('button[title="Excluir Grupo"]').first();
              await expect(deleteButton).toBeVisible({ timeout: 30000 });
              await deleteButton.click({ timeout: 30000 });
              await expectDialogTextVisible(page, "Confirmar exclusão", 30000);
            },
            screenshot: "desktop-group-delete",
          },
          basePath,
        );
        } finally {
          await groupDeletePage.close();
        }
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
      const firstProductSlug = await getFirstProductSlug(desktopPage, basePath);
      const productPath = `/admin/products/${firstProductSlug}`;

      if (shouldRunCheck("product-details")) {
        await desktopPage.goto(`${basePath}${productPath}`, {
          waitUntil: "networkidle",
        });
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-details",
            heading: "Contatos em caso de problemas",
            secondary: "Gerenciar contatos",
            screenshot: "desktop-product-details",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-dependencies")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-dependencies",
            path: productPath,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, productPath);
              await page.locator('button[title="Gerenciar dependências"]').click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Gerenciar Dependências" })).toBeVisible({ timeout: 30000 });
              await page.getByRole("button", { name: "Nova Dependência" }).click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Adicionar Dependência" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-product-dependencies",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-manual")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-manual",
            path: productPath,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, productPath);
              await page.getByRole("button", { name: "Editar manual" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Editor do Manual", 30000);
              await expect(page.getByRole("button", { name: "Salvar Manual" })).toBeVisible({ timeout: 15000 });
            },
            screenshot: "desktop-product-manual",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-problems")) {
        await desktopPage.goto(`${basePath}${productPath}/problems`, {
          waitUntil: "networkidle",
        });
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-problems",
            waitFor: async (page) => {
              await expect(page.getByRole("button", { name: "Adicionar problema" })).toBeVisible({ timeout: 15000 });
              await expect(page.getByRole("button", { name: "Gerenciar categorias" })).toBeVisible({ timeout: 15000 });
              await expect(page.getByText("Soluções")).toBeVisible({ timeout: 15000 });
            },
            secondary: "Adicionar problema",
            screenshot: "desktop-product-problems",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-problem-create")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-problem-create",
            path: `${productPath}/problems`,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, `${productPath}/problems`);
              await page.getByRole("button", { name: "Adicionar problema" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Adicionar problema", 30000);
            },
            screenshot: "desktop-product-problem-create",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-problem-edit")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-problem-edit",
            path: `${productPath}/problems`,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, `${productPath}/problems`);
              await page.getByRole("button", { name: "Editar problema" }).click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Editar problema" })).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-product-problem-edit",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-problem-delete")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-problem-delete",
            path: `${productPath}/problems`,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, `${productPath}/problems`);
              await page.getByRole("button", { name: "Editar problema" }).click({ timeout: 15000 });
              await expect(page.getByRole("dialog", { name: "Editar problema" })).toBeVisible({ timeout: 30000 });
              await page.getByRole("button", { name: "Excluir problema" }).click({ timeout: 15000 });
              await expect(page.getByText("Tem certeza que deseja excluir este problema?")).toBeVisible({ timeout: 30000 });
            },
            screenshot: "desktop-product-problem-delete",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-category-create")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-category-create",
            path: `${productPath}/problems`,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, `${productPath}/problems`);
              await page.getByRole("button", { name: "Gerenciar categorias" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Gerenciar categorias de problemas", 30000);
              await page.getByRole("button", { name: "Cadastrar categoria" }).click({ timeout: 15000 });
              await expectDialogTextVisible(page, "Cadastrar categoria", 30000);
            },
            screenshot: "desktop-product-category-create",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-solution-create")) {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-solution-create",
            path: `${productPath}/problems`,
            waitFor: async (page, routeBasePath) => {
              await reloadPage(page, routeBasePath, `${productPath}/problems`);
              await page.getByRole("button", { name: "Adicionar solução" }).first().click({ timeout: 15000 });
              await expectModalHeadingVisible(page, "Adicionar solução", 30000);
            },
            screenshot: "desktop-product-solution-create",
          },
          basePath,
        );
      }

      if (shouldRunCheck("product-data-flow")) {
        await desktopPage.goto(`${basePath}${productPath}/data-flow`, {
          waitUntil: "networkidle",
        });
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name: "product-data-flow",
            waitFor: async (page) => {
              await expect(page.locator(".data-flow-gantt-shell")).toBeVisible({ timeout: 15000 });
              await expect(page.getByText("Nome")).toBeVisible({ timeout: 15000 });
              await expect(page.getByText("Inicio")).toBeVisible({ timeout: 15000 });
              await expect(page.getByText("Fim")).toBeVisible({ timeout: 15000 });
            },
            secondary: "Nome",
            screenshot: "desktop-product-data-flow",
          },
          basePath,
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