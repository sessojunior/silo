#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { buildAssistantPromptCorpus } from "./ai-assistant-smoke-corpus.mjs";

dotenv.config();

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";

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

function parseOptionalPositiveInt(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function truncateText(value, maxLength) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
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

function countByChallenge(results, predicate = () => true) {
  return results.reduce((accumulator, result) => {
    if (!predicate(result)) {
      return accumulator;
    }

    const key =
      typeof result.challenge === "string" && result.challenge.length > 0
        ? result.challenge
        : "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function cookieHeaderFromSetCookie(setCookieHeaders) {
  return setCookieHeaders
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((cookie) => typeof cookie === "string" && cookie.length > 0)
    .join("; ");
}

async function readBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, options);
  const body = await readBody(response);
  return { response, body };
}

async function requestJson(path, method, body, context) {
  const headers = {
    ...(context.cookie ? { cookie: context.cookie } : {}),
  };

  const requestOptions = {
    method,
    headers,
  };

  if (typeof body !== "undefined") {
    requestOptions.headers = {
      ...requestOptions.headers,
      "content-type": "application/json",
    };
    requestOptions.body = JSON.stringify(body);
  }

  return request(path, requestOptions);
}

async function loginWithPassword(email, password) {
  const response = await fetch(new URL("/api/auth/login/password", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await readBody(response);
  assert.equal(response.status, 200, "Login administrativo: esperado 200");
  assert.equal(body.success, true, "Login administrativo: esperado sucesso");

  const cookie = cookieHeaderFromSetCookie(getSetCookieHeaders(response.headers));
  assert.ok(cookie.length > 0, "Login administrativo não retornou cookie de sessão.");

  return cookie;
}
async function runAssistantCase(context, threadId, scenario, index, total) {
  const startedAt = Date.now();

  try {
    const response = await requestJson(
      "/api/ai-assistant/messages",
      "POST",
      {
        threadId,
        content: scenario.prompt,
      },
      context,
    );

    const data = response.body?.data ?? null;
    const generationStatus = data?.generation?.status ?? null;
    const contractErrors = [];
    const recordCheck = (condition, message) => {
      if (!condition) {
        contractErrors.push(message);
      }
    };

    recordCheck(
      response.response.status === 200,
      `POST /api/ai-assistant/messages: esperado 200 em ${scenario.key}`,
    );
    recordCheck(
      response.body?.success === true,
      `POST /api/ai-assistant/messages: esperado sucesso em ${scenario.key}`,
    );
    recordCheck(Boolean(data), `POST /api/ai-assistant/messages: data ausente em ${scenario.key}`);
    recordCheck(data?.threadId === threadId, `threadId divergente em ${scenario.key}`);
    recordCheck(Boolean(data?.thread), `thread ausente em ${scenario.key}`);
    recordCheck(data?.thread?.id === threadId, `thread.id divergente em ${scenario.key}`);
    recordCheck(
      typeof data?.answer === "string" && data.answer.trim().length > 0,
      `answer inválido em ${scenario.key}`,
    );
    recordCheck(
      typeof data?.messageContent === "string" && data.messageContent.trim().length > 0,
      `messageContent inválido em ${scenario.key}`,
    );
    recordCheck(Array.isArray(data?.citations), `citations inválido em ${scenario.key}`);
    recordCheck(
      Array.isArray(data?.suggestedQuestions),
      `suggestedQuestions inválido em ${scenario.key}`,
    );
    recordCheck(
      typeof data?.contextSummary === "string" && data.contextSummary.trim().length > 0,
      `contextSummary vazio em ${scenario.key}`,
    );
    recordCheck(
      generationStatus === "success" || generationStatus === "fallback",
      `generation.status inválido em ${scenario.key}`,
    );

    if (scenario.expectedInScope === false) {
      recordCheck(
        typeof data?.refusalReason === "string" && data.refusalReason.trim().length > 0,
        `refusalReason inválido em ${scenario.key}`,
      );
    }

    const report = {
      key: scenario.key,
      category: scenario.category,
      challenge: scenario.challenge ?? null,
      prompt: scenario.prompt,
      expectedScope: scenario.expectedScope ?? null,
      expectedInScope:
        typeof scenario.expectedInScope === "boolean" ? scenario.expectedInScope : null,
      httpStatus: response.response.status,
      responseOk: response.response.ok,
      apiSuccess: Boolean(response.body?.success),
      success: contractErrors.length === 0,
      contractErrors,
      threadId: data?.threadId ?? null,
      threadTitle: data?.thread?.title ?? null,
      scope: data?.scope ?? null,
      isInScope: typeof data?.isInScope === "boolean" ? data.isInScope : null,
      refusalReason: data?.refusalReason ?? null,
      generationStatus,
      generationProvider: data?.generation?.provider ?? null,
      generationModel: data?.generation?.model ?? null,
      generationLatencyMs:
        typeof data?.generation?.latencyMs === "number" ? data.generation.latencyMs : null,
      citationsCount: Array.isArray(data?.citations) ? data.citations.length : 0,
      suggestedQuestionsCount: Array.isArray(data?.suggestedQuestions)
        ? data.suggestedQuestions.length
        : 0,
      answerPreview: truncateText(data?.answer ?? "", 240),
      contextSummaryPreview: truncateText(data?.contextSummary ?? "", 180),
      scopeMatchesExpectation:
        typeof scenario.expectedScope === "string" ? data?.scope === scenario.expectedScope : null,
      inScopeMatchesExpectation:
        typeof scenario.expectedInScope === "boolean"
          ? data?.isInScope === scenario.expectedInScope
          : null,
      durationMs: Date.now() - startedAt,
    };

    const statusIcon = report.success ? "✓" : "✗";
    console.log(
      `${statusIcon} ${String(index + 1).padStart(2, "0")}/${total} ${scenario.key} | scope=${report.scope ?? "n/a"} | generation=${generationStatus ?? "n/a"}`,
    );

    return report;
  } catch (error) {
    const failure = {
      key: scenario.key,
      category: scenario.category,
      challenge: scenario.challenge ?? null,
      prompt: scenario.prompt,
      expectedScope: scenario.expectedScope ?? null,
      expectedInScope:
        typeof scenario.expectedInScope === "boolean" ? scenario.expectedInScope : null,
      success: false,
      error: serializeError(error),
      durationMs: Date.now() - startedAt,
    };

    console.log(
      `✗ ${String(index + 1).padStart(2, "0")}/${total} ${scenario.key} | request=error`,
    );

    return failure;
  }
}

async function runAssistantSmokeSuite(context) {
  const examplesResult = await request("/api/ai-assistant/examples", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(examplesResult.response.status, 200, "GET /api/ai-assistant/examples: esperado 200");
  assert.equal(examplesResult.body.success, true);
  assert.ok(examplesResult.body.data);
  assert.ok(Array.isArray(examplesResult.body.data.examples));
  assert.ok(examplesResult.body.data.examples.length >= 7, "GET /api/ai-assistant/examples: exemplos insuficientes");

  const createThreadResult = await requestJson(
    "/api/ai-assistant/threads",
    "POST",
    {},
    context,
  );

  assert.equal(createThreadResult.response.status, 201, "POST /api/ai-assistant/threads: esperado 201");
  assert.equal(createThreadResult.body.success, true);
  assert.ok(createThreadResult.body.data);

  const threadId = createThreadResult.body.data.thread.id;
  assert.equal(typeof threadId, "string");

  const corpus = buildAssistantPromptCorpus();
  const limit = parseOptionalPositiveInt(getOption("--limit") ?? process.env.API_ASSISTANT_SMOKE_LIMIT);
  const selectedCorpus = limit ? corpus.slice(0, limit) : corpus;
  const results = [];

  console.log(`Assistente de IA: ${selectedCorpus.length} prompts`);
  if (limit) {
    console.log(`Assistente de IA: limite aplicado ${limit}`);
  }

  for (let index = 0; index < selectedCorpus.length; index += 1) {
    const scenario = selectedCorpus[index];
    const result = await runAssistantCase(
      context,
      threadId,
      scenario,
      index,
      selectedCorpus.length,
    );
    results.push(result);
  }

  const detailResult = await request(`/api/ai-assistant/threads/${encodeURIComponent(threadId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  const threadValidationErrors = [];
  const detailData = detailResult.body?.data ?? null;
  const recordThreadCheck = (condition, message) => {
    if (!condition) {
      threadValidationErrors.push(message);
    }
  };

  recordThreadCheck(
    detailResult.response.status === 200,
    "GET /api/ai-assistant/threads/:id: esperado 200",
  );
  recordThreadCheck(detailResult.body?.success === true, "GET /api/ai-assistant/threads/:id: esperado sucesso");
  recordThreadCheck(Boolean(detailData), "GET /api/ai-assistant/threads/:id: data ausente");
  recordThreadCheck(detailData?.thread?.id === threadId, "thread.id divergente no detalhe");
  recordThreadCheck(
    detailData?.thread?.messageCount === selectedCorpus.length * 2,
    "messageCount divergente no detalhe",
  );
  recordThreadCheck(
    Array.isArray(detailData?.messages) && detailData.messages.length === selectedCorpus.length * 2,
    "quantidade de mensagens divergente no detalhe",
  );
  recordThreadCheck(
    detailData?.messages?.[0]?.content === selectedCorpus[0]?.prompt,
    "primeira mensagem divergente no detalhe",
  );
  recordThreadCheck(
    detailData?.messages?.[detailData?.messages?.length - 1]?.senderType === "assistant",
    "última mensagem esperada do assistente no detalhe",
  );

  const summary = {
    total: selectedCorpus.length,
    successful: results.filter((result) => result.success === true).length,
    requestFailures: results.filter((result) => result.error).length,
    contractFailures: results.filter(
      (result) => result.success === false && Array.isArray(result.contractErrors),
    ).length,
    scopeMismatches: results.filter(
      (result) => result.success === true && result.scopeMatchesExpectation === false,
    ).length,
    inScopeMismatches: results.filter(
      (result) => result.success === true && result.inScopeMatchesExpectation === false,
    ).length,
    fallbackCount: results.filter((result) => result.generationStatus === "fallback").length,
    successCount: results.filter((result) => result.generationStatus === "success").length,
    challenges: countByChallenge(results),
    mismatchesByChallenge: countByChallenge(
      results,
      (result) =>
        result.success === true &&
        (result.scopeMatchesExpectation === false || result.inScopeMatchesExpectation === false),
    ),
  };

  const threadValidation = {
    success: threadValidationErrors.length === 0,
    httpStatus: detailResult.response.status,
    errors: threadValidationErrors,
    threadId,
    messageCount: detailData?.thread?.messageCount ?? null,
  };

  const reportDir = path.resolve(
    getOption("--report-dir") ??
      process.env.API_ASSISTANT_SMOKE_REPORT_DIR ??
      path.join(process.cwd(), ".assistant-smoke"),
  );
  await fs.mkdir(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, "api-assistant-smoke-report.json");
  await fs.writeFile(
    reportPath,
    `${JSON.stringify({ summary, threadValidation, results }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Assistente de IA concluído: ${summary.successCount}/${summary.total} com geração direta, ${summary.fallbackCount} com fallback`,
  );
  console.log(`Assistente de IA relatório: ${reportPath}`);

  return {
    reportPath,
    summary,
    threadValidation,
    hasFailures:
      summary.requestFailures > 0 ||
      summary.contractFailures > 0 ||
      summary.scopeMismatches > 0 ||
      summary.inScopeMismatches > 0 ||
      threadValidation.success === false,
  };
}

async function main() {
  const email = getOption("--email") ?? process.env.API_SMOKE_EMAIL;
  const password = getOption("--password") ?? process.env.API_SMOKE_PASSWORD;
  const cookieOverride = getOption("--cookie") ?? process.env.API_SMOKE_COOKIE;

  assert.ok(baseUrl, "Base URL da API ausente.");

  const context = {
    cookie: cookieOverride ?? "",
  };

  if (!context.cookie) {
    assert.ok(email, "API_SMOKE_EMAIL é obrigatório quando não há cookie.");
    assert.ok(password, "API_SMOKE_PASSWORD é obrigatório quando não há cookie.");
    context.cookie = await loginWithPassword(email, password);
  }

  const result = await runAssistantSmokeSuite(context);

  if (result.hasFailures) {
    throw new Error(
      `Smoke do assistente encontrou falhas ou divergências. Veja ${result.reportPath}.`,
    );
  }
}

const baseUrl = new URL(getOption("--base-url") ?? process.env.API_ASSISTANT_SMOKE_BASE_URL ?? DEFAULT_BASE_URL);

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});