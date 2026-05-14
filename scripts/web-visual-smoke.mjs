#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { chromium, expect } from "@playwright/test";
import { buildAssistantPromptCorpus } from "./ai-assistant-smoke-corpus.mjs";

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
    .split(/,\s*(?=better-auth\.)/)
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

function buildCookieOverrideEntries(cookieOverride) {
  const sessionCookies = cookieOverride
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const equalsIndex = cookie.indexOf("=");
      if (equalsIndex <= 0) return null;

      return {
        name: cookie.slice(0, equalsIndex).trim(),
        value: cookie.slice(equalsIndex + 1).trim(),
      };
    })
    .filter((cookie) => cookie !== null);

  return [webRouteBaseUrl, apiBaseUrl].flatMap((url) =>
    sessionCookies.map((cookie) => ({
      url,
      name: cookie.name,
      value: cookie.value,
    })),
  );
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
  await context.route(/\/api\/admin\/ai-assistant\//, async (route) => {
    await route.continue();
  });
  await context.route(/\.(?:woff2?|ttf|otf)(?:\?.*)?$/i, (route) => route.abort());
}

async function signInInBrowser(page, routeBasePath, userEmail, userPassword) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login/password`, {
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

  const cookieUrls = [webRouteBaseUrl, apiBaseUrl];
  await page.context().addCookies(
    cookieUrls.flatMap((url) =>
      authCookies.map((cookie) => ({
        url,
        name: cookie.name,
        value: cookie.value,
      })),
    ),
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
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function openFirstProjectKanban(page, routeBasePath) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const projectPathMatch = new URL(page.url()).pathname.match(/\/admin\/projects\/([^/]+)/);
  assert.ok(projectPathMatch?.[1], "Não foi possível identificar o projeto para abrir o kanban.");
  const projectId = projectPathMatch[1];

  try {
    const browserCookies = await page.context().cookies();
    const cookieHeader = browserCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    const response = await fetch(`${apiBaseUrl}/api/admin/projects/${projectId}/activities`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });

    if (response.ok) {
      const payload = (await response.json());
      const activities = payload?.success && Array.isArray(payload?.data?.activities) ? payload.data.activities : [];
      const firstActivity = activities.find((activity) => activity && typeof activity.id === "string" && activity.id.length > 0);

      if (firstActivity) {
        await page.goto(
          `${routeBasePath}/admin/projects/${projectId}/activities/${firstActivity.id}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.waitForLoadState("networkidle").catch(() => {});
        return;
      }
    }
  } catch {
    // Mantém o fluxo visual como fallback quando a API não estiver disponível.
  }

  await expect(page.getByRole("button", { name: "Nova atividade" })).toBeVisible({ timeout: 60000 });
  const kanbanButton = page.locator('button[title="Abrir Kanban"]').first();
  await expect(kanbanButton).toBeVisible({ timeout: 120000 });
  await kanbanButton.scrollIntoViewIfNeeded();
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
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await firstRow.waitFor({ state: "attached", timeout: 60000 });
  await firstRow.scrollIntoViewIfNeeded();
  try {
    await firstRow.hover({ timeout: 30000 });
  } catch {
    const rowBox = await firstRow.boundingBox();
    if (rowBox) {
      await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    }
  }

  await page.waitForTimeout(250);

  const actionButton = firstRow.locator(`button[title="${buttonTitle}"]`).first();
  await actionButton.waitFor({ state: "attached", timeout: 60000 });
  if (await actionButton.isVisible().catch(() => false)) {
    await actionButton.click();
    return;
  }

  await actionButton.click({ force: true });
}

async function expectDialogTextVisible(page, text, timeout = 15000) {
  await expect(page.getByRole("dialog").getByText(text, { exact: true })).toBeVisible({ timeout });
}

async function expectModalHeadingVisible(page, text, timeout = 15000) {
  await expect(page.locator("h3", { hasText: text })).toBeVisible({ timeout });
}

const ASSISTANT_ROUTE = "/admin/ai-assistant";
const ASSISTANT_HEADER_HEADING = "Assistente de IA";
const ASSISTANT_EMPTY_HEADING = "Nova conversa";
const ASSISTANT_INPUT_PLACEHOLDER = "Pergunte sobre modelos, pend\u00eancias, relat\u00f3rios, problemas, solu\u00e7\u00f5es ou projetos do Silo...";

function parseOptionalPositiveInt(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeArtifactName(value) {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "assistant-case"
  );
}

function truncateText(value, maxLength) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

async function readPlaywrightJsonResponse(response) {
  const responseText = await response.text();
  const headers = response.headers();
  const contentType = headers["content-type"] ?? headers["Content-Type"] ?? "";

  if (responseText.trim().length === 0) {
    return {
      payload: null,
      parseError: null,
      rawBody: "",
      contentType,
    };
  }

  try {
    return {
      payload: JSON.parse(responseText),
      parseError: null,
      rawBody: responseText,
      contentType,
    };
  } catch (error) {
    return {
      payload: null,
      parseError: serializeError(error),
      rawBody: responseText,
      contentType,
    };
  }
}

async function prepareAssistantShell(page, routeBasePath) {
  if (debugCookies) {
    page.on("request", (request) => {
      if (request.url().includes(ASSISTANT_ROUTE) && request.resourceType() === "document") {
        console.log("assistant smoke navigation cookie header:", request.headers().cookie ?? "");
      }
    });
  }

  await reloadPage(page, routeBasePath, ASSISTANT_ROUTE);
  await page.waitForLoadState("networkidle").catch(() => {});

  await expect(page.url()).toContain(ASSISTANT_ROUTE);
  await expect(page.getByPlaceholder(ASSISTANT_INPUT_PLACEHOLDER)).toBeVisible({ timeout: 60000 });
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Alternar lateral" })).toHaveCount(0);
}

async function runAssistantScenario(page, routeBasePath, outputDir, scenario, index, total) {
  await prepareAssistantShell(page, routeBasePath);

  const input = page.getByPlaceholder(ASSISTANT_INPUT_PLACEHOLDER);
  const responsePromise = page.waitForResponse(
    (response) =>
      (response.url().includes("/api/admin/ai-assistant/messages") ||
        response.url().includes("/api/ai-assistant/messages")) &&
      response.request().method() === "POST",
    { timeout: 120000 },
  );

  await input.fill(scenario.prompt);
  await input.press("Enter");

  const apiResponse = await responsePromise;
  const { payload, parseError, rawBody, contentType } =
    await readPlaywrightJsonResponse(apiResponse);

  await expect(page.locator("p.whitespace-pre-wrap")).toHaveCount(2, { timeout: 120000 });
  await expect(page.getByText("Pensando...")).toHaveCount(0, { timeout: 120000 });

  const messageTexts = await page.locator("p.whitespace-pre-wrap").allTextContents();
  const assistantMessageText = messageTexts[1] ?? "";
  const responseData = payload && typeof payload === "object" ? payload.data ?? null : null;
  const responseThread = responseData && typeof responseData === "object" ? responseData.thread ?? null : null;
  const responseGeneration = responseData && typeof responseData === "object" ? responseData.generation ?? null : null;
  const responseCitations = Array.isArray(responseData?.citations) ? responseData.citations : [];
  const responseSuggestedQuestions = Array.isArray(responseData?.suggestedQuestions)
    ? responseData.suggestedQuestions
    : [];

  const artifactBaseName = `${String(index + 1).padStart(2, "0")}-${normalizeArtifactName(scenario.key)}`;
  const screenshotPath = path.join(outputDir, `${artifactBaseName}.png`);
  const reportPath = path.join(outputDir, `${artifactBaseName}.json`);
  const report = {
    key: scenario.key,
    category: scenario.category,
    challenge: scenario.challenge ?? null,
    prompt: scenario.prompt,
    expectedScope: scenario.expectedScope ?? null,
    expectedInScope: typeof scenario.expectedInScope === "boolean" ? scenario.expectedInScope : null,
    httpStatus: apiResponse.status(),
    responseOk: apiResponse.ok(),
    apiSuccess: Boolean(payload?.success),
    responseError:
      payload && typeof payload === "object" && typeof payload.error === "string" ? payload.error : null,
    parseError,
    responseContentType: contentType,
    rawBodyPreview: truncateText(rawBody, 240),
    success: Boolean(apiResponse.ok() && payload?.success && responseData),
    threadId: responseData?.threadId ?? null,
    threadTitle: responseThread?.title ?? null,
    scope: responseData?.scope ?? null,
    isInScope: typeof responseData?.isInScope === "boolean" ? responseData.isInScope : null,
    refusalReason: responseData?.refusalReason ?? null,
    generationStatus: responseGeneration?.status ?? null,
    generationProvider: responseGeneration?.provider ?? null,
    generationModel: responseGeneration?.model ?? null,
    suggestedQuestionsCount: responseSuggestedQuestions.length,
    citationsCount: responseCitations.length,
    answerPreview: truncateText(
      responseData?.messageContent ?? responseData?.answer ?? assistantMessageText,
      240,
    ),
    displayedPreview: truncateText(assistantMessageText, 240),
    scopeMatchesExpectation:
      typeof scenario.expectedScope === "string" ? responseData?.scope === scenario.expectedScope : null,
    inScopeMatchesExpectation:
      typeof scenario.expectedInScope === "boolean"
        ? responseData?.isInScope === scenario.expectedInScope
        : null,
    screenshotPath,
    reportPath,
    caseIndex: index + 1,
    totalCases: total,
  };

  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
    timeout: 120000,
    animations: "disabled",
  });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`✓ ${String(index + 1).padStart(2, "0")}/${total} ${scenario.key}`);
  console.log(`  screenshot: ${screenshotPath}`);
  console.log(`  report: ${reportPath}`);
  console.log(`  response: ${report.httpStatus} | scope=${report.scope ?? "n/a"} | generation=${report.generationStatus ?? "n/a"}`);

  return report;
}

async function runAssistantSmokeSuite(page, routeBasePath, outputDir) {
  const assistantOutputDir = path.join(outputDir, "ai-assistant");
  await fs.mkdir(assistantOutputDir, { recursive: true });

  const parsedLimit = parseOptionalPositiveInt(
    getOption("--assistant-limit") ?? process.env.WEB_VISUAL_ASSISTANT_LIMIT,
  );
  const corpus = buildAssistantPromptCorpus();
  const selectedCorpus = parsedLimit ? corpus.slice(0, parsedLimit) : corpus;
  const results = [];

  console.log(`AI assistant smoke suite: ${selectedCorpus.length} prompts`);
  if (parsedLimit) {
    console.log(`AI assistant smoke suite limit applied: ${parsedLimit}`);
  }

  for (let index = 0; index < selectedCorpus.length; index += 1) {
    const scenario = selectedCorpus[index];
    try {
      const result = await runAssistantScenario(
        page,
        routeBasePath,
        assistantOutputDir,
        scenario,
        index,
        selectedCorpus.length,
      );
      results.push(result);
    } catch (error) {
      const failure = {
        key: scenario.key,
        category: scenario.category,
        prompt: scenario.prompt,
        expectedScope: scenario.expectedScope ?? null,
        expectedInScope: typeof scenario.expectedInScope === "boolean" ? scenario.expectedInScope : null,
        error: serializeError(error),
        success: false,
        caseIndex: index + 1,
        totalCases: selectedCorpus.length,
      };
      const artifactBaseName = `${String(index + 1).padStart(2, "0")}-${normalizeArtifactName(scenario.key)}`;
      const failureReportPath = path.join(assistantOutputDir, `${artifactBaseName}.json`);
      await fs.writeFile(failureReportPath, `${JSON.stringify(failure, null, 2)}\n`, "utf8");
      console.error(`✗ ${String(index + 1).padStart(2, "0")}/${selectedCorpus.length} ${scenario.key}`);
      console.error(error);
      results.push(failure);
    }
  }

  const summary = {
    total: results.length,
    successful: results.filter((result) => result.success === true).length,
    scopeMismatches: results.filter(
      (result) =>
        typeof result.expectedScope === "string" &&
        result.success === true &&
        result.scope !== result.expectedScope,
    ).length,
    inScopeMismatches: results.filter(
      (result) =>
        typeof result.expectedInScope === "boolean" &&
        result.success === true &&
        typeof result.isInScope === "boolean" &&
        result.isInScope !== result.expectedInScope,
    ).length,
    fallbackResponses: results.filter((result) => result.generationStatus === "fallback").length,
    errorResponses: results.filter((result) => result.generationStatus === "error").length,
  };

  const summaryPath = path.join(assistantOutputDir, "assistant-smoke-report.json");
  await fs.writeFile(
    summaryPath,
    `${JSON.stringify({ summary, results }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Assistant smoke summary: ${summary.successful}/${summary.total} successful`);
  console.log(`Assistant smoke report: ${summaryPath}`);
}

async function runInventory() {
  console.log("Visual smoke inventory");
  console.log(`- Base URL do web: ${webRouteBaseUrl}`);
  console.log(`- Base URL da API: ${apiBaseUrl}`);
  console.log("- Auth mobile: /login, /register, /login-email, /forget-password, /setup-password");
  console.log("- Admin desktop: /admin/welcome, /admin/dashboard, /admin/dashboard (registro/histórico de turno), /admin/settings, /admin/settings/products, /admin/projects, /admin/projects/:projectId, /admin/projects/:projectId/activities/:activityId, /admin/products/:slug, /admin/products/:slug/problems, /admin/products/:slug/data-flow, /admin/groups, /admin/groups/users, /admin/contacts, /admin/monitoring, /admin/chat/groups, /admin/chat/users, /admin/chat/groups/:groupId, /admin/chat/users/:userId, /admin/help, /admin/reports/availability, /admin/reports/problems, /admin/reports/projects, /admin/ai-assistant (corpus em lote com screenshots e JSON por caso)");
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
const debugCookies = ["1", "true"].includes((process.env.WEB_VISUAL_DEBUG_COOKIES ?? "").toLowerCase());

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
        await freshContext.addCookies(buildCookieOverrideEntries(cookieOverride));
      } else {
        const desktopCookies = await desktopContext.cookies();
        const sessionCookies = desktopCookies.filter((cookie) =>
          cookie.name.startsWith("better-auth.session_"),
        );
        assert.ok(sessionCookies.length > 0, "Login administrativo não persistiu cookies de sessão no navegador.");
        if (debugCookies) {
          console.log(
            "assistant smoke desktop session cookies:",
            sessionCookies.map((cookie) => ({
              name: cookie.name,
              domain: cookie.domain,
              path: cookie.path,
            })),
          );
        }
        await freshContext.addCookies(
          [webRouteBaseUrl, apiBaseUrl].flatMap((url) =>
            sessionCookies.map((cookie) => ({
              url,
              name: cookie.name,
              value: cookie.value,
            })),
          ),
        );
        if (debugCookies) {
          const freshCookies = await freshContext.cookies();
          console.log(
            "assistant smoke fresh session cookies:",
            freshCookies.filter((cookie) => cookie.name.startsWith("better-auth."))
              .map((cookie) => ({
                name: cookie.name,
                domain: cookie.domain,
                path: cookie.path,
              })),
          );
        }
      }

      return { freshContext, freshPage };
    };

    const desktopContext = await browser.newContext(desktopContextOptions);
    await blockFontRequests(desktopContext);

    const desktopPage = await desktopContext.newPage();
    if (cookieOverride) {
      await desktopContext.addCookies(buildCookieOverrideEntries(cookieOverride));
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
            await isolatedContext.addCookies(buildCookieOverrideEntries(cookieOverride));
          } else {
            const desktopCookies = await desktopContext.cookies();
            const sessionCookies = desktopCookies.filter((cookie) =>
              cookie.name.startsWith("better-auth.session_"),
            );
            assert.ok(sessionCookies.length > 0, "Login administrativo não persistiu cookies de sessão no navegador.");
            if (debugCookies) {
              console.log(
                "assistant smoke isolated session cookies:",
                sessionCookies.map((cookie) => ({
                  name: cookie.name,
                  domain: cookie.domain,
                  path: cookie.path,
                })),
              );
            }
            await isolatedContext.addCookies(
              [webRouteBaseUrl, apiBaseUrl].flatMap((url) =>
                sessionCookies.map((cookie) => ({
                  url,
                  name: cookie.name,
                  value: cookie.value,
                })),
              ),
            );
            if (debugCookies) {
              const isolatedCookies = await isolatedContext.cookies();
              console.log(
                "assistant smoke isolated fresh session cookies:",
                isolatedCookies.filter((cookie) => cookie.name.startsWith("better-auth."))
                  .map((cookie) => ({
                    name: cookie.name,
                    domain: cookie.domain,
                    path: cookie.path,
                  })),
              );
            }
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

    if (shouldRunCheck("ai-assistant")) {
      const {
        freshContext: assistantContext,
        freshPage: assistantPage,
      } = await createFreshAuthenticatedPage();
      try {
        await runAssistantSmokeSuite(assistantPage, basePath, screenshotDir);
      } finally {
        await assistantContext.close();
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
              await page.waitForLoadState("networkidle").catch(() => {});
              const createButton = page.locator("main").getByRole("button", { name: "Novo projeto" });
              await expect(createButton).toBeVisible({ timeout: 120000 });
              await createButton.click({ timeout: 120000 });
              const projectDialog = page.getByRole("dialog", { name: "Novo Projeto" });
              await expect(projectDialog).toBeVisible({ timeout: 120000 });
              await expect(projectDialog.getByText("Novo Projeto", { exact: true })).toBeVisible({ timeout: 120000 });
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
      await signInInBrowser(desktopPage, basePath, email, password);

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
                await page.waitForLoadState("networkidle").catch(() => {});
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
                await page.waitForLoadState("networkidle").catch(() => {});
                await expect(page.getByRole("button", { name: "Nova atividade" })).toBeVisible({ timeout: 60000 });
                const editButton = page.locator('button[title="Editar atividade"]').first();
                await expect(editButton).toBeVisible({ timeout: 60000 });
                await editButton.scrollIntoViewIfNeeded();
                await editButton.click({ timeout: 60000 });
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
      const runGroupCheck = async (name, screenshot, waitFor) => {
        await runPageCheck(
          desktopPage,
          screenshotDir,
          {
            name,
            path: "/admin/groups",
            waitFor,
            screenshot,
          },
          basePath,
        );
      };

      if (shouldRunCheck("group-create")) {
        await signInInBrowser(desktopPage, basePath, email, password);
        const { freshContext: groupCreateContext, freshPage: groupCreatePage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            groupCreatePage,
            screenshotDir,
            {
              name: "group-create",
              path: "/admin/groups",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/groups");
                await page.waitForLoadState("networkidle").catch(() => {});
                const createButton = page.getByRole("button", { name: "Novo grupo" });
                await expect(createButton).toBeVisible({ timeout: 120000 });
                await createButton.click({ timeout: 120000 });
                const groupDialog = page.getByRole("dialog", { name: "Novo Grupo" });
                await expect(groupDialog).toBeVisible({ timeout: 120000 });
                await expect(groupDialog.getByText("Novo Grupo", { exact: true })).toBeVisible({ timeout: 120000 });
              },
              screenshot: "desktop-group-create",
            },
            basePath,
          );
        } finally {
          await groupCreateContext.close();
        }
      }

      if (shouldRunCheck("group-permissions")) {
        const { freshContext: groupPermissionsContext, freshPage: groupPermissionsPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            groupPermissionsPage,
            screenshotDir,
            {
              name: "group-permissions",
              path: "/admin/groups",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/groups");
                await page.waitForLoadState("networkidle").catch(() => {});
                const permissionsButton = page.locator('button[title="Permissões do Grupo"]').first();
                await expect(permissionsButton).toBeVisible({ timeout: 120000 });
                await permissionsButton.click({ timeout: 120000 });
                const permissionsDialog = page.getByRole("dialog", { name: "Permissões do grupo" });
                await expect(permissionsDialog).toBeVisible({ timeout: 120000 });
                await expect(permissionsDialog.getByText("Permissões do grupo", { exact: true })).toBeVisible({ timeout: 120000 });
                await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 120000 });
              },
              screenshot: "desktop-group-permissions",
            },
            basePath,
          );
        } finally {
          await groupPermissionsContext.close();
        }
      }

      if (shouldRunCheck("group-users")) {
        const { freshContext: groupUsersContext, freshPage: groupUsersPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            groupUsersPage,
            screenshotDir,
            {
              name: "group-users",
              path: "/admin/groups",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/groups");
                await page.waitForLoadState("networkidle").catch(() => {});
                const usersButton = page.locator('button[title="Gerenciar Usuários"]').first();
                await expect(usersButton).toBeVisible({ timeout: 120000 });
                await usersButton.click({ timeout: 120000 });
                const usersDialog = page.getByRole("dialog", { name: "Gerenciar Usuários" });
                await expect(usersDialog).toBeVisible({ timeout: 120000 });
                await expect(usersDialog.getByText("Gerenciar Usuários", { exact: true })).toBeVisible({ timeout: 120000 });
                await expect(page.getByRole("button", { name: "Salvar Alterações" })).toBeVisible({ timeout: 120000 });
              },
              screenshot: "desktop-group-users",
            },
            basePath,
          );
        } finally {
          await groupUsersContext.close();
        }
      }

      if (shouldRunCheck("group-edit")) {
        const { freshContext: groupEditContext, freshPage: groupEditPage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            groupEditPage,
            screenshotDir,
            {
              name: "group-edit",
              path: "/admin/groups",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/groups");
                await page.waitForLoadState("networkidle").catch(() => {});
                await clickFirstRowAction(page, "Editar Grupo");
                const editDialog = page.getByRole("dialog", { name: "Editar Grupo" });
                await expect(editDialog).toBeVisible({ timeout: 120000 });
                await expect(editDialog.getByText("Editar Grupo", { exact: true })).toBeVisible({ timeout: 120000 });
              },
              screenshot: "desktop-group-edit",
            },
            basePath,
          );
        } finally {
          await groupEditContext.close();
        }
      }

      if (shouldRunCheck("group-delete")) {
        const { freshContext: groupDeleteContext, freshPage: groupDeletePage } = await createFreshAuthenticatedPage();
        try {
          await runPageCheck(
            groupDeletePage,
            screenshotDir,
            {
              name: "group-delete",
              path: "/admin/groups",
              waitFor: async (page, routeBasePath) => {
                await reloadPage(page, routeBasePath, "/admin/groups");
                await page.waitForLoadState("networkidle").catch(() => {});
                await clickFirstRowAction(page, "Excluir Grupo");
                await expectDialogTextVisible(page, "Confirmar exclusão", 120000);
              },
              screenshot: "desktop-group-delete",
            },
            basePath,
          );
        } finally {
          await groupDeleteContext.close();
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
              await page.waitForLoadState("networkidle").catch(() => {});
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
              await page.waitForLoadState("networkidle").catch(() => {});
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
              await page.waitForLoadState("networkidle").catch(() => {});
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
            await page.waitForLoadState("networkidle").catch(() => {});
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
            await page.waitForLoadState("networkidle").catch(() => {});
            const editProblemButton = page.getByRole("button", { name: "Editar problema" });
            await expect(editProblemButton).toBeVisible({ timeout: 60000 });
            await editProblemButton.click({ timeout: 60000 });
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
            await page.waitForLoadState("networkidle").catch(() => {});
            const editProblemButton = page.getByRole("button", { name: "Editar problema" });
            await expect(editProblemButton).toBeVisible({ timeout: 60000 });
            await editProblemButton.click({ timeout: 60000 });
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
            await page.waitForLoadState("networkidle").catch(() => {});
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
            await page.waitForLoadState("networkidle").catch(() => {});
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