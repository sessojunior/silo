#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

dotenv.config();

const DEFAULT_BASE_URL = "http://localhost:3001";

const argv = process.argv.slice(2);
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2F4b8AAAAASUVORK5CYII=";

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

function toBoolean(value) {
  return typeof value === "string" && value.toLowerCase() === "true";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeTinyPngBlob() {
  return new Blob([Buffer.from(TINY_PNG_BASE64, "base64")], {
    type: "image/png",
  });
}

function isoDatePlusDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeSmokeToken(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function getDatabaseConnectionString() {
  return (
    process.env.DATABASE_URL_DEV ||
    process.env.DATABASE_URL_PROD ||
    process.env.DATABASE_URL ||
    ""
  );
}

function shouldUseSsl(connectionString) {
  const lower = connectionString.toLowerCase();
  return lower.includes("sslmode=require") || lower.includes("neon.tech");
}

async function withDatabaseClient(callback) {
  const connectionString = getDatabaseConnectionString();
  assert.ok(connectionString, "DATABASE_URL_DEV, DATABASE_URL_PROD ou DATABASE_URL é obrigatório para o smoke de tasks.");

  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

const baseUrl = new URL(
  getOption("--base-url") ?? process.env.API_SMOKE_BASE_URL ?? DEFAULT_BASE_URL,
);
const email = getOption("--email") ?? process.env.API_SMOKE_EMAIL;
const password = getOption("--password") ?? process.env.API_SMOKE_PASSWORD;
const cookieOverride = getOption("--cookie") ?? process.env.API_SMOKE_COOKIE;
const inventoryOnly = hasFlag("--inventory") || toBoolean(process.env.API_SMOKE_INVENTORY);
const expectAdmin = hasFlag("--expect-admin") || toBoolean(process.env.API_SMOKE_EXPECT_ADMIN);

const publicChecks = [
  {
    name: "GET /health",
    method: "GET",
    path: "/health",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.status, "ok");
      assert.equal(body.app, "silo-api");
    },
  },
  {
    name: "GET /api/server-time",
    method: "GET",
    path: "/api/server-time",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.equal(typeof body.data.time, "string");
      assert.equal(body.message, "Hora do servidor");
    },
  },
  {
    name: "GET /api/auth/get-session sem login",
    method: "GET",
    path: "/api/auth/get-session",
    expectedStatus: 401,
  },
  {
    name: "GET /api/check-admin sem login",
    method: "GET",
    path: "/api/check-admin",
    expectedStatus: 401,
  },
  {
    name: "GET /api/users sem login",
    method: "GET",
    path: "/api/users",
    expectedStatus: 401,
  },
  {
    name: "GET /api/projects sem login",
    method: "GET",
    path: "/api/projects",
    expectedStatus: 401,
  },
  {
    name: "GET /api/products sem login",
    method: "GET",
    path: "/api/products",
    expectedStatus: 401,
  },
  {
    name: "GET /api/contacts sem login",
    method: "GET",
    path: "/api/contacts",
    expectedStatus: 401,
  },
  {
    name: "GET /api/reports/availability sem login",
    method: "GET",
    path: "/api/reports/availability",
    expectedStatus: 401,
  },
  {
    name: "GET /api/dashboard sem login",
    method: "GET",
    path: "/api/dashboard",
    expectedStatus: 401,
  },
  {
    name: "GET /api/chat/messages sem login",
    method: "GET",
    path: "/api/chat/messages",
    expectedStatus: 401,
  },
];

const authChecks = [
  {
    name: "POST /api/auth/login/password",
    method: "POST",
    path: "/api/auth/login/password",
    expectedStatus: 200,
    body: (context) => ({ email: context.email, password: context.password }),
    validate(body) {
      assert.equal(body.success, true);
      assert.equal(body.data.signedIn, true);
      assert.equal(body.message, "Login realizado com sucesso!");
    },
  },
  {
    name: "GET /api/auth/get-session com login",
    method: "GET",
    path: "/api/auth/get-session",
    expectedStatus: 200,
    validate(body) {
      assert.equal(typeof body, "object");
      assert.ok(body !== null);
    },
  },
  {
    name: "GET /api/users/profile com login",
    method: "GET",
    path: "/api/users/profile",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/users/preferences com login",
    method: "GET",
    path: "/api/users/preferences",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
];

const adminChecks = [
  {
    name: "GET /api/users com admin",
    method: "GET",
    path: "/api/users",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/projects com admin",
    method: "GET",
    path: "/api/projects",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/products com admin",
    method: "GET",
    path: "/api/products",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/contacts com admin",
    method: "GET",
    path: "/api/contacts",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/reports/availability com admin",
    method: "GET",
    path: "/api/reports/availability",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/dashboard com admin",
    method: "GET",
    path: "/api/dashboard",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/help com admin",
    method: "GET",
    path: "/api/help",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
    },
  },
  {
    name: "GET /api/help/images com admin",
    method: "GET",
    path: "/api/help/images",
    expectedStatus: 200,
    validate(body) {
      assert.equal(body.success, true);
      assert.ok(body.data);
      assert.ok(Array.isArray(body.data.items));
    },
  },
];

function printInventory() {
  console.log(`Base URL: ${baseUrl.toString()}`);
  console.log("");
  console.log("Públicas e negativas:");
  for (const check of publicChecks) {
    console.log(`- ${check.method} ${check.path} -> ${check.expectedStatus}`);
  }
  console.log("");
  console.log("Autenticadas opcionais:");
  for (const check of authChecks) {
    console.log(`- ${check.method} ${check.path}`);
  }
  console.log("");
  console.log("Admin opcionais:");
  for (const check of adminChecks) {
    console.log(`- ${check.method} ${check.path}`);
  }
  console.log("");
  console.log("Upload e produtos estendidos:");
  console.log("- POST /api/upload/avatar (multipart)");
  console.log("- GET /api/upload/serve/avatars/:filename");
  console.log("- GET /api/products/* principais com um produto existente");
  console.log("- Escritas seguras: availability-exceptions, contacts, dependencies, problems e solutions");
  console.log("- Escritas seguras: projects e project activities");
  console.log("- Escritas seguras: groups, permissions e users");
  console.log("- Escritas seguras: incidents e monitoring");
  console.log("- Escritas seguras: tasks users/history com restauração exata");
  console.log("- Fluxos de auth-custom: sign-up, login-email, forget-password, setup-password e login-google");
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
  const headers = new Headers();

  if (context.cookie) {
    headers.set("cookie", context.cookie);
  }

  headers.set("content-type", "application/json");

  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  const responseBody = await readBody(response);
  return { response, body: responseBody };
}

async function requestMultipart(path, formData, context) {
  const headers = new Headers();
  if (context.cookie) {
    headers.set("cookie", context.cookie);
  }

  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  const body = await readBody(response);

  return { response, body };
}

async function runCheck(check, context) {
  const headers = new Headers(check.headers ?? {});

  if (context.cookie) {
    headers.set("cookie", context.cookie);
  }

  let body;
  if (typeof check.body === "function") {
    body = check.body(context);
  } else if (check.body !== undefined) {
    body = check.body;
  }

  if (body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const { response, body: responseBody } = await request(check.path, {
    method: check.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (Array.isArray(check.expectedStatus)) {
    assert.ok(
      check.expectedStatus.includes(response.status),
      `${check.name}: esperado ${check.expectedStatus.join(" ou ")}, recebido ${response.status}`,
    );
  } else {
    assert.equal(
      response.status,
      check.expectedStatus,
      `${check.name}: esperado ${check.expectedStatus}, recebido ${response.status}`,
    );
  }

  if (typeof check.validate === "function") {
    await check.validate(responseBody, response, context);
  }

  console.log(`✓ ${check.name}`);
  return { response, body: responseBody };
}

async function runUploadRoundtrip(context) {
  const formData = new FormData();
  formData.append("file", makeTinyPngBlob(), "api-smoke.png");
  let filename = "";
  let cleanedUp = false;

  try {
    const uploadResult = await requestMultipart("/api/upload/avatar", formData, context);

    assert.equal(uploadResult.response.status, 201, "POST /api/upload/avatar: esperado 201");
    assert.equal(uploadResult.body.success, true);
    assert.equal(typeof uploadResult.body.data.url, "string");
    assert.equal(typeof uploadResult.body.data.filename, "string");

    filename = uploadResult.body.data.filename;
    const servedPath = `/api/upload/serve/avatars/${encodeURIComponent(filename)}`;

    const servedResult = await request(servedPath, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(servedResult.response.status, 200, "GET /api/upload/serve/avatars/:filename: esperado 200");

    const deleteResult = await request(servedPath, {
      method: "DELETE",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(deleteResult.response.status, 200, "DELETE /api/upload/serve/avatars/:filename: esperado 200");
    cleanedUp = true;

    const missingResult = await request(servedPath, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(missingResult.response.status, 404, "GET /api/upload/serve/avatars/:filename após exclusão: esperado 404");

    console.log("✓ POST/GET/DELETE /api/upload/avatar roundtrip");
  } finally {
    if (filename && !cleanedUp) {
      const servedPath = `/api/upload/serve/avatars/${encodeURIComponent(filename)}`;
      try {
        await request(servedPath, {
          method: "DELETE",
          headers: context.cookie ? { cookie: context.cookie } : undefined,
        });
      } catch {
        // limpeza best-effort
      }
    }
  }
}

async function loadSmokeProduct(context) {
  const { response, body } = await request("/api/products?limit=1", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(response.status, 200, "GET /api/products?limit=1: esperado 200");
  assert.equal(body.success, true);
  assert.ok(body.data);

  const firstProduct = Array.isArray(body.data.items) ? body.data.items[0] : undefined;
  assert.ok(firstProduct, "GET /api/products?limit=1 não retornou produto suficiente para o smoke.");
  assert.equal(typeof firstProduct.id, "string");
  assert.equal(typeof firstProduct.slug, "string");

  return {
    productId: firstProduct.id,
    productSlug: firstProduct.slug,
  };
}

function findTreeItem(items, targetId) {
  for (const item of items) {
    if (item.id === targetId) {
      return item;
    }

    if (Array.isArray(item.children)) {
      const child = findTreeItem(item.children, targetId);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

async function runProductsExtendedReadChecks(context, product) {
  const date = todayIsoDate();

  const checks = [
    {
      name: "GET /api/products/manual com produto",
      path: `/api/products/manual?productId=${encodeURIComponent(product.productId)}`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
      },
    },
    {
      name: "GET /api/products/contacts com produto",
      path: `/api/products/contacts?productId=${encodeURIComponent(product.productId)}`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
      },
    },
    {
      name: "GET /api/products/dependencies com produto",
      path: `/api/products/dependencies?productId=${encodeURIComponent(product.productId)}`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
      },
    },
    {
      name: "GET /api/products/problems/categories",
      path: "/api/products/problems/categories",
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
      },
    },
    {
      name: "GET /api/products/problems com slug",
      path: `/api/products/problems?slug=${encodeURIComponent(product.productSlug)}`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
      },
    },
    {
      name: "GET /api/products/availability-exceptions com produto",
      path: `/api/products/availability-exceptions?productId=${encodeURIComponent(product.productId)}`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
        assert.ok(Array.isArray(bodyValue.data.items));
      },
    },
    {
      name: "GET /api/products/activities/availability com produto",
      path: `/api/products/activities/availability?productId=${encodeURIComponent(product.productId)}&date=${encodeURIComponent(date)}&turn=0`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
        assert.equal(typeof bodyValue.data.requestedDate, "string");
        assert.equal(typeof bodyValue.data.requestedTurn, "number");
        assert.equal(typeof bodyValue.data.fits, "boolean");
        assert.equal(typeof bodyValue.data.reason, "string");
      },
    },
    {
      name: "GET /api/products/:id/history com produto",
      path: `/api/products/${encodeURIComponent(product.productId)}/history?date=${encodeURIComponent(date)}&turn=0`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
        assert.ok(Array.isArray(bodyValue.data.history));
      },
    },
    {
      name: "GET /api/products/:slug/data-flow com produto",
      path: `/api/products/${encodeURIComponent(product.productSlug)}/data-flow?date=${encodeURIComponent(date)}&turn=0`,
      validate(bodyValue) {
        assert.equal(bodyValue.success, true);
        assert.ok(bodyValue.data);
        assert.ok(Array.isArray(bodyValue.data.pipelines));
      },
    },
  ];

  for (const check of checks) {
    const result = await request(check.path, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(result.response.status, 200, `${check.name}: esperado 200`);
    if (typeof check.validate === "function") {
      await check.validate(result.body, result.response, context);
    }
    console.log(`✓ ${check.name}`);
  }
}

async function findFreeAvailabilityExceptionSlot(context, productId) {
  const response = await request(`/api/products/availability-exceptions?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(response.response.status, 200, "GET /api/products/availability-exceptions: esperado 200");
  assert.equal(response.body.success, true);

  const existingItems = Array.isArray(response.body.data?.items) ? response.body.data.items : [];
  const candidateTypes = ["extra", "pause", "holiday"];

  for (const offset of [1825, 1826, 1827, 1828, 1829, 1830]) {
    const date = isoDatePlusDays(offset);
    for (const type of candidateTypes) {
      const matches = existingItems.some((item) => item.date === date && item.type === type);
      if (!matches) {
        return { date, type };
      }
    }
  }

  throw new Error("Não foi possível encontrar um slot livre para testar availability-exceptions sem sobrescrever dados existentes.");
}

async function runAvailabilityExceptionWriteRoundtrip(context, productId) {
  const slot = await findFreeAvailabilityExceptionSlot(context, productId);
  const description = `Smoke availability ${makeSmokeToken("availability")}`;

  const createResult = await requestJson(
    "/api/products/availability-exceptions",
    "POST",
    {
      productId,
      date: slot.date,
      type: slot.type,
      description,
    },
    context,
  );

  assert.equal(createResult.response.status, 200, "POST /api/products/availability-exceptions: esperado 200");
  assert.equal(createResult.body.success, true);
  assert.ok(createResult.body.data);

  const exceptionId = createResult.body.data.id;
  assert.equal(typeof exceptionId, "string");

  const afterCreate = await request(`/api/products/availability-exceptions?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterCreate.response.status, 200, "GET /api/products/availability-exceptions após POST: esperado 200");
  assert.equal(afterCreate.body.success, true);
  assert.ok(afterCreate.body.data);
  assert.ok(afterCreate.body.data.items.some((item) => item.id === exceptionId));

  const deleteResult = await request(`/api/products/availability-exceptions?id=${encodeURIComponent(exceptionId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteResult.response.status, 200, "DELETE /api/products/availability-exceptions: esperado 200");
  assert.equal(deleteResult.body.success, true);

  const afterDelete = await request(`/api/products/availability-exceptions?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterDelete.response.status, 200, "GET /api/products/availability-exceptions após DELETE: esperado 200");
  assert.equal(afterDelete.body.success, true);
  assert.ok(afterDelete.body.data);
  assert.ok(!afterDelete.body.data.items.some((item) => item.id === exceptionId));

  console.log("✓ POST/DELETE /api/products/availability-exceptions roundtrip");
}

async function runContactsWriteRoundtrip(context, productId) {
  const currentContactsResult = await request(`/api/products/contacts?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(currentContactsResult.response.status, 200, "GET /api/products/contacts: esperado 200");
  assert.equal(currentContactsResult.body.success, true);
  assert.ok(currentContactsResult.body.data);

  const originalContacts = Array.isArray(currentContactsResult.body.data.contacts)
    ? currentContactsResult.body.data.contacts
    : [];
  const originalContactIds = originalContacts.map((item) => item.id);

  const tempContactToken = makeSmokeToken("contact");
  const tempEmail = `${tempContactToken}@example.com`.toLowerCase();
  const createContactResult = await requestJson(
    "/api/contacts",
    "POST",
    {
      name: `Smoke Contact ${tempContactToken}`,
      role: "Operação",
      team: "Smoke",
      email: tempEmail,
      phone: null,
      active: true,
    },
    context,
  );

  assert.equal(createContactResult.response.status, 201, "POST /api/contacts: esperado 201");
  assert.equal(createContactResult.body.success, true);
  assert.ok(createContactResult.body.data);

  const tempContactId = createContactResult.body.data.id;
  assert.equal(typeof tempContactId, "string");

  const replaceResult = await requestJson(
    "/api/products/contacts",
    "POST",
    {
      productId,
      contactIds: [tempContactId],
    },
    context,
  );

  assert.equal(replaceResult.response.status, 200, "POST /api/products/contacts: esperado 200");
  assert.equal(replaceResult.body.success, true);

  const afterReplace = await request(`/api/products/contacts?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterReplace.response.status, 200, "GET /api/products/contacts após POST: esperado 200");
  assert.equal(afterReplace.body.success, true);
  assert.ok(afterReplace.body.data);
  assert.deepEqual(
    afterReplace.body.data.contacts.map((item) => item.id),
    [tempContactId],
  );

  const restoreResult = await requestJson(
    "/api/products/contacts",
    "POST",
    {
      productId,
      contactIds: originalContactIds,
    },
    context,
  );

  assert.equal(restoreResult.response.status, 200, "POST /api/products/contacts para restaurar: esperado 200");
  assert.equal(restoreResult.body.success, true);

  const afterRestore = await request(`/api/products/contacts?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterRestore.response.status, 200, "GET /api/products/contacts após restore: esperado 200");
  assert.equal(afterRestore.body.success, true);
  assert.ok(afterRestore.body.data);
  assert.deepEqual(
    afterRestore.body.data.contacts.map((item) => item.id),
    originalContactIds,
  );

  const deleteContactResult = await requestJson(
    "/api/contacts",
    "DELETE",
    {
      id: tempContactId,
    },
    context,
  );

  assert.equal(deleteContactResult.response.status, 200, "DELETE /api/contacts: esperado 200");
  assert.equal(deleteContactResult.body.success, true);

  console.log("✓ POST/DELETE /api/contacts e POST /api/products/contacts roundtrip");
}

async function runDependenciesWriteRoundtrip(context, productId) {
  const dependencyToken = makeSmokeToken("dependency");
  const dependencyName = `Smoke Dependency ${dependencyToken}`;

  const createResult = await requestJson(
    "/api/products/dependencies",
    "POST",
    {
      productId,
      name: dependencyName,
      icon: "icon-[lucide--box]",
      description: `Smoke dependency ${dependencyToken}`,
      parentId: null,
    },
    context,
  );

  assert.equal(createResult.response.status, 201, "POST /api/products/dependencies: esperado 201");
  assert.equal(createResult.body.success, true);
  assert.ok(createResult.body.data);

  const dependencyId = createResult.body.data.dependency.id;
  assert.equal(typeof dependencyId, "string");

  const afterCreate = await request(`/api/products/dependencies?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterCreate.response.status, 200, "GET /api/products/dependencies após POST: esperado 200");
  assert.equal(afterCreate.body.success, true);
  assert.ok(afterCreate.body.data);
  assert.ok(findTreeItem(afterCreate.body.data.dependencies, dependencyId));

  const updatedName = `${dependencyName} (updated)`;
  const updateResult = await requestJson(
    "/api/products/dependencies",
    "PUT",
    {
      id: dependencyId,
      name: updatedName,
      icon: "icon-[lucide--package]",
      description: `Smoke dependency ${dependencyToken} updated`,
      parentId: null,
    },
    context,
  );

  assert.equal(updateResult.response.status, 200, "PUT /api/products/dependencies: esperado 200");
  assert.equal(updateResult.body.success, true);

  const afterUpdate = await request(`/api/products/dependencies?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterUpdate.response.status, 200, "GET /api/products/dependencies após PUT: esperado 200");
  assert.equal(afterUpdate.body.success, true);
  assert.ok(afterUpdate.body.data);

  const updatedDependency = findTreeItem(afterUpdate.body.data.dependencies, dependencyId);
  assert.ok(updatedDependency);
  assert.equal(updatedDependency.name, updatedName);

  const deleteResult = await requestJson(
    "/api/products/dependencies",
    "DELETE",
    {
      id: dependencyId,
    },
    context,
  );

  assert.equal(deleteResult.response.status, 200, "DELETE /api/products/dependencies: esperado 200");
  assert.equal(deleteResult.body.success, true);

  const afterDelete = await request(`/api/products/dependencies?productId=${encodeURIComponent(productId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(afterDelete.response.status, 200, "GET /api/products/dependencies após DELETE: esperado 200");
  assert.equal(afterDelete.body.success, true);
  assert.ok(afterDelete.body.data);
  assert.ok(!findTreeItem(afterDelete.body.data.dependencies, dependencyId));

  console.log("✓ POST/PUT/DELETE /api/products/dependencies roundtrip");
}

async function runProblemsAndSolutionsWriteRoundtrip(context, productId, productSlug) {
  const categoriesResult = await request("/api/products/problems/categories", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(categoriesResult.response.status, 200, "GET /api/products/problems/categories: esperado 200");
  assert.equal(categoriesResult.body.success, true);

  const categories = Array.isArray(categoriesResult.body.data) ? categoriesResult.body.data : [];
  assert.ok(categories.length > 0, "GET /api/products/problems/categories não retornou categorias para o smoke.");

  const categoryId = categories[0].id;
  const problemToken = makeSmokeToken("problem");
  const problemTitle = `Smoke Problem ${problemToken}`;
  const problemDescription = `Smoke problem ${problemToken} description used to validate create, update and delete.`;

  const createProblemResult = await requestJson(
    "/api/products/problems",
    "POST",
    {
      productId,
      title: problemTitle,
      description: problemDescription,
      problemCategoryId: categoryId,
    },
    context,
  );

  assert.equal(createProblemResult.response.status, 201, "POST /api/products/problems: esperado 201");
  assert.equal(createProblemResult.body.success, true);

  const problemsAfterCreate = await request(`/api/products/problems?slug=${encodeURIComponent(productSlug)}&page=1&limit=200`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(problemsAfterCreate.response.status, 200, "GET /api/products/problems após POST: esperado 200");
  assert.equal(problemsAfterCreate.body.success, true);
  assert.ok(problemsAfterCreate.body.data);

  const createdProblem = problemsAfterCreate.body.data.items.find((item) => item.title === problemTitle);
  assert.ok(createdProblem);

  const problemId = createdProblem.id;
  const updatedProblemTitle = `${problemTitle} (updated)`;
  const updatedProblemDescription = `${problemDescription} Updated to validate the PUT roundtrip.`;

  const updateProblemResult = await requestJson(
    "/api/products/problems",
    "PUT",
    {
      id: problemId,
      title: updatedProblemTitle,
      description: updatedProblemDescription,
      problemCategoryId: categoryId,
    },
    context,
  );

  assert.equal(updateProblemResult.response.status, 200, "PUT /api/products/problems: esperado 200");
  assert.equal(updateProblemResult.body.success, true);

  const problemsAfterUpdate = await request(`/api/products/problems?slug=${encodeURIComponent(productSlug)}&page=1&limit=200`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(problemsAfterUpdate.response.status, 200, "GET /api/products/problems após PUT: esperado 200");
  assert.equal(problemsAfterUpdate.body.success, true);
  assert.ok(problemsAfterUpdate.body.data);

  const updatedProblem = problemsAfterUpdate.body.data.items.find((item) => item.id === problemId);
  assert.ok(updatedProblem);
  assert.equal(updatedProblem.title, updatedProblemTitle);
  assert.equal(updatedProblem.description, updatedProblemDescription);

  const solutionToken = makeSmokeToken("solution");
  const solutionDescription = `Smoke solution ${solutionToken}`;

  const createSolutionResult = await requestJson(
    "/api/products/solutions",
    "POST",
    {
      problemId,
      description: solutionDescription,
    },
    context,
  );

  assert.equal(createSolutionResult.response.status, 201, "POST /api/products/solutions: esperado 201");
  assert.equal(createSolutionResult.body.success, true);

  const solutionsAfterCreate = await request(`/api/products/solutions?problemId=${encodeURIComponent(problemId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(solutionsAfterCreate.response.status, 200, "GET /api/products/solutions após POST: esperado 200");
  assert.equal(solutionsAfterCreate.body.success, true);
  assert.ok(solutionsAfterCreate.body.data);

  const createdSolution = solutionsAfterCreate.body.data.items.find((item) => item.description === solutionDescription);
  assert.ok(createdSolution);

  const solutionId = createdSolution.id;
  const updatedSolutionDescription = `${solutionDescription} Updated to validate the PUT roundtrip.`;

  const updateSolutionResult = await requestJson(
    "/api/products/solutions",
    "PUT",
    {
      id: solutionId,
      description: updatedSolutionDescription,
    },
    context,
  );

  assert.equal(updateSolutionResult.response.status, 200, "PUT /api/products/solutions: esperado 200");
  assert.equal(updateSolutionResult.body.success, true);

  const solutionsAfterUpdate = await request(`/api/products/solutions?problemId=${encodeURIComponent(problemId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(solutionsAfterUpdate.response.status, 200, "GET /api/products/solutions após PUT: esperado 200");
  assert.equal(solutionsAfterUpdate.body.success, true);
  assert.ok(solutionsAfterUpdate.body.data);

  const updatedSolution = solutionsAfterUpdate.body.data.items.find((item) => item.id === solutionId);
  assert.ok(updatedSolution);
  assert.equal(updatedSolution.description, updatedSolutionDescription);

  const deleteSolutionResult = await requestJson(
    "/api/products/solutions",
    "DELETE",
    {
      id: solutionId,
    },
    context,
  );

  assert.equal(deleteSolutionResult.response.status, 200, "DELETE /api/products/solutions: esperado 200");
  assert.equal(deleteSolutionResult.body.success, true);

  const solutionsAfterDelete = await request(`/api/products/solutions?problemId=${encodeURIComponent(problemId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(solutionsAfterDelete.response.status, 200, "GET /api/products/solutions após DELETE: esperado 200");
  assert.equal(solutionsAfterDelete.body.success, true);
  assert.ok(solutionsAfterDelete.body.data);
  assert.ok(!solutionsAfterDelete.body.data.items.some((item) => item.id === solutionId));

  const deleteProblemResult = await requestJson(
    "/api/products/problems",
    "DELETE",
    {
      id: problemId,
    },
    context,
  );

  assert.equal(deleteProblemResult.response.status, 200, "DELETE /api/products/problems: esperado 200");
  assert.equal(deleteProblemResult.body.success, true);

  const problemsAfterDelete = await request(`/api/products/problems?slug=${encodeURIComponent(productSlug)}&page=1&limit=200`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(problemsAfterDelete.response.status, 200, "GET /api/products/problems após DELETE: esperado 200");
  assert.equal(problemsAfterDelete.body.success, true);
  assert.ok(problemsAfterDelete.body.data);
  assert.ok(!problemsAfterDelete.body.data.items.some((item) => item.id === problemId));

  console.log("✓ POST/PUT/DELETE /api/products/problems e /api/products/solutions roundtrip");
}

async function runProductsExtendedWriteChecks(context, product) {
  await runAvailabilityExceptionWriteRoundtrip(context, product.productId);
  await runContactsWriteRoundtrip(context, product.productId);
  await runDependenciesWriteRoundtrip(context, product.productId);
  await runProblemsAndSolutionsWriteRoundtrip(context, product.productId, product.productSlug);
}

async function runProductsExtendedChecks(context) {
  const product = await loadSmokeProduct(context);

  await runProductsExtendedReadChecks(context, product);
  await runProductsExtendedWriteChecks(context, product);

  console.log("✓ Bloco de help, upload e products-extended validado");
}

async function runProjectsWriteRoundtrip(context) {
  const projectToken = makeSmokeToken("project");
  const projectName = `Smoke Project ${projectToken}`;
  const projectShortDescription = `Smoke short description ${projectToken}`;
  const projectDescription = `Smoke project ${projectToken} description used to validate create, update and delete.`;

  const createResult = await requestJson(
    "/api/projects",
    "POST",
    {
      name: projectName,
      shortDescription: projectShortDescription,
      description: projectDescription,
      startDate: todayIsoDate(),
      endDate: isoDatePlusDays(14),
      priority: "medium",
      status: "active",
    },
    context,
  );

  assert.equal(createResult.response.status, 201, "POST /api/projects: esperado 201");
  assert.equal(createResult.body.success, true);
  assert.ok(createResult.body.data);

  const projectId = createResult.body.data.id;
  assert.equal(typeof projectId, "string");

  const listAfterCreate = await request(`/api/projects?search=${encodeURIComponent(projectToken)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(listAfterCreate.response.status, 200, "GET /api/projects após POST: esperado 200");
  assert.equal(listAfterCreate.body.success, true);
  assert.ok(Array.isArray(listAfterCreate.body.data));
  assert.ok(listAfterCreate.body.data.some((item) => item.id === projectId));

  const updatedProjectName = `${projectName} (updated)`;
  const updatedProjectShortDescription = `${projectShortDescription} updated`;
  const updatedProjectDescription = `${projectDescription} Updated to validate the PUT roundtrip.`;

  const updateResult = await requestJson(
    "/api/projects",
    "PUT",
    {
      id: projectId,
      name: updatedProjectName,
      shortDescription: updatedProjectShortDescription,
      description: updatedProjectDescription,
      startDate: todayIsoDate(),
      endDate: isoDatePlusDays(15),
      priority: "high",
      status: "active",
    },
    context,
  );

  assert.equal(updateResult.response.status, 200, "PUT /api/projects: esperado 200");
  assert.equal(updateResult.body.success, true);
  assert.ok(updateResult.body.data);

  const listAfterUpdate = await request(`/api/projects?search=${encodeURIComponent(projectToken)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(listAfterUpdate.response.status, 200, "GET /api/projects após PUT: esperado 200");
  assert.equal(listAfterUpdate.body.success, true);
  assert.ok(Array.isArray(listAfterUpdate.body.data));

  const updatedProject = listAfterUpdate.body.data.find((item) => item.id === projectId);
  assert.ok(updatedProject);
  assert.equal(updatedProject.name, updatedProjectName);
  assert.equal(updatedProject.shortDescription, updatedProjectShortDescription);

  const activityToken = makeSmokeToken("activity");
  const activityName = `Smoke Activity ${activityToken}`;
  const activityDescription = `Smoke project activity ${activityToken} used to validate create, update and delete.`;

  const createActivityResult = await requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/activities`,
    "POST",
    {
      name: activityName,
      description: activityDescription,
      category: "Smoke",
      estimatedDays: 3,
      startDate: todayIsoDate(),
      endDate: isoDatePlusDays(3),
      priority: "medium",
      status: "todo",
    },
    context,
  );

  assert.equal(createActivityResult.response.status, 201, "POST /api/projects/:projectId/activities: esperado 201");
  assert.equal(createActivityResult.body.success, true);
  assert.ok(createActivityResult.body.data);

  const activityId = createActivityResult.body.data.id;
  assert.equal(typeof activityId, "string");

  const activitiesAfterCreate = await request(`/api/projects/${encodeURIComponent(projectId)}/activities`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(activitiesAfterCreate.response.status, 200, "GET /api/projects/:projectId/activities após POST: esperado 200");
  assert.equal(activitiesAfterCreate.body.success, true);
  assert.ok(Array.isArray(activitiesAfterCreate.body.data.activities));
  assert.ok(activitiesAfterCreate.body.data.activities.some((item) => item.id === activityId));

  const updatedActivityName = `${activityName} (updated)`;
  const updatedActivityDescription = `${activityDescription} Updated to validate the PUT roundtrip.`;

  const updateActivityResult = await requestJson(
    `/api/projects/${encodeURIComponent(projectId)}/activities`,
    "PUT",
    {
      id: activityId,
      name: updatedActivityName,
      description: updatedActivityDescription,
      category: "Smoke",
      estimatedDays: 4,
      startDate: todayIsoDate(),
      endDate: isoDatePlusDays(4),
      priority: "high",
      status: "progress",
    },
    context,
  );

  assert.equal(updateActivityResult.response.status, 200, "PUT /api/projects/:projectId/activities: esperado 200");
  assert.equal(updateActivityResult.body.success, true);
  assert.ok(updateActivityResult.body.data);

  const activitiesAfterUpdate = await request(`/api/projects/${encodeURIComponent(projectId)}/activities`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(activitiesAfterUpdate.response.status, 200, "GET /api/projects/:projectId/activities após PUT: esperado 200");
  assert.equal(activitiesAfterUpdate.body.success, true);
  assert.ok(Array.isArray(activitiesAfterUpdate.body.data.activities));

  const updatedActivity = activitiesAfterUpdate.body.data.activities.find((item) => item.id === activityId);
  assert.ok(updatedActivity);
  assert.equal(updatedActivity.name, updatedActivityName);
  assert.equal(updatedActivity.description, updatedActivityDescription);

  const deleteActivityResult = await request(`/api/projects/${encodeURIComponent(projectId)}/activities?activityId=${encodeURIComponent(activityId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteActivityResult.response.status, 200, "DELETE /api/projects/:projectId/activities: esperado 200");
  assert.equal(deleteActivityResult.body.success, true);

  const activitiesAfterDelete = await request(`/api/projects/${encodeURIComponent(projectId)}/activities`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(activitiesAfterDelete.response.status, 200, "GET /api/projects/:projectId/activities após DELETE: esperado 200");
  assert.equal(activitiesAfterDelete.body.success, true);
  assert.ok(Array.isArray(activitiesAfterDelete.body.data.activities));
  assert.ok(!activitiesAfterDelete.body.data.activities.some((item) => item.id === activityId));

  const deleteResult = await request(`/api/projects?id=${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteResult.response.status, 200, "DELETE /api/projects: esperado 200");
  assert.equal(deleteResult.body.success, true);

  const listAfterDelete = await request(`/api/projects?search=${encodeURIComponent(projectToken)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(listAfterDelete.response.status, 200, "GET /api/projects após DELETE: esperado 200");
  assert.equal(listAfterDelete.body.success, true);
  assert.ok(Array.isArray(listAfterDelete.body.data));
  assert.ok(!listAfterDelete.body.data.some((item) => item.id === projectId));

  console.log("✓ POST/PUT/DELETE /api/projects e /api/projects/:projectId/activities roundtrip");
}

async function runGroupsAndUsersWriteRoundtrip(context) {
  const groupToken = makeSmokeToken("group");
  const groupName = `Smoke Group ${groupToken}`;
  const groupDescription = `Smoke group ${groupToken} used to validate group and user CRUD.`;

  const createGroupResult = await requestJson(
    "/api/groups",
    "POST",
    {
      name: groupName,
      description: groupDescription,
      icon: "icon-[lucide--users]",
      color: "#3B82F6",
      role: "user",
      active: true,
      isDefault: false,
    },
    context,
  );

  assert.equal(createGroupResult.response.status, 201, "POST /api/groups: esperado 201");
  assert.equal(createGroupResult.body.success, true);
  assert.ok(createGroupResult.body.data);

  const groupId = createGroupResult.body.data.id;
  assert.equal(typeof groupId, "string");

  const groupsAfterCreate = await request("/api/groups?search=Smoke%20Group", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(groupsAfterCreate.response.status, 200, "GET /api/groups após POST: esperado 200");
  assert.equal(groupsAfterCreate.body.success, true);
  assert.ok(groupsAfterCreate.body.data);
  assert.ok(groupsAfterCreate.body.data.items.some((item) => item.id === groupId));

  const updatedGroupName = `${groupName} (updated)`;
  const updatedGroupDescription = `${groupDescription} Updated to validate the PUT roundtrip.`;

  const updateGroupResult = await requestJson(
    "/api/groups",
    "PUT",
    {
      id: groupId,
      name: updatedGroupName,
      description: updatedGroupDescription,
      icon: "icon-[lucide--shield]",
      color: "#2563EB",
      role: "user",
      active: true,
      isDefault: false,
    },
    context,
  );

  assert.equal(updateGroupResult.response.status, 200, "PUT /api/groups: esperado 200");
  assert.equal(updateGroupResult.body.success, true);
  assert.ok(updateGroupResult.body.data);

  const groupsAfterUpdate = await request("/api/groups?search=Smoke%20Group", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(groupsAfterUpdate.response.status, 200, "GET /api/groups após PUT: esperado 200");
  assert.equal(groupsAfterUpdate.body.success, true);
  assert.ok(groupsAfterUpdate.body.data);

  const updatedGroup = groupsAfterUpdate.body.data.items.find((item) => item.id === groupId);
  assert.ok(updatedGroup);
  assert.equal(updatedGroup.name, updatedGroupName);
  assert.equal(updatedGroup.description, updatedGroupDescription);

  const permissionsEnableResult = await requestJson(
    "/api/groups/permissions",
    "PUT",
    {
      groupId,
      resource: "projects",
      action: "create",
      enabled: true,
    },
    context,
  );

  assert.equal(permissionsEnableResult.response.status, 200, "PUT /api/groups/permissions enable: esperado 200");
  assert.equal(permissionsEnableResult.body.success, true);

  const permissionsAfterEnable = await request(`/api/groups/permissions?groupId=${encodeURIComponent(groupId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(permissionsAfterEnable.response.status, 200, "GET /api/groups/permissions após enable: esperado 200");
  assert.equal(permissionsAfterEnable.body.success, true);
  assert.ok(permissionsAfterEnable.body.data);
  assert.ok(permissionsAfterEnable.body.data.permissions);
  assert.ok(Array.isArray(permissionsAfterEnable.body.data.permissions.projects));
  assert.ok(permissionsAfterEnable.body.data.permissions.projects.includes("create"));

  const permissionsDisableResult = await requestJson(
    "/api/groups/permissions",
    "PUT",
    {
      groupId,
      resource: "projects",
      action: "create",
      enabled: false,
    },
    context,
  );

  assert.equal(permissionsDisableResult.response.status, 200, "PUT /api/groups/permissions disable: esperado 200");
  assert.equal(permissionsDisableResult.body.success, true);

  const permissionsAfterDisable = await request(`/api/groups/permissions?groupId=${encodeURIComponent(groupId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(permissionsAfterDisable.response.status, 200, "GET /api/groups/permissions após disable: esperado 200");
  assert.equal(permissionsAfterDisable.body.success, true);
  assert.ok(permissionsAfterDisable.body.data);
  assert.ok(permissionsAfterDisable.body.data.permissions);
  assert.ok(Array.isArray(permissionsAfterDisable.body.data.permissions.projects));
  assert.ok(!permissionsAfterDisable.body.data.permissions.projects.includes("create"));

  const userToken = makeSmokeToken("user");
  const userName = `Smoke User ${userToken}`;
  const userEmail = `${userToken}@example.com`.toLowerCase();

  const createUserResult = await requestJson(
    "/api/users",
    "POST",
    {
      name: userName,
      email: userEmail,
      password: "SmokeUser#123",
      groupId,
      isActive: true,
    },
    context,
  );

  assert.equal(createUserResult.response.status, 201, "POST /api/users: esperado 201");
  assert.equal(createUserResult.body.success, true);
  assert.ok(createUserResult.body.data);

  const userId = createUserResult.body.data.id;
  assert.equal(typeof userId, "string");

  const usersAfterCreate = await request("/api/users", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(usersAfterCreate.response.status, 200, "GET /api/users após POST: esperado 200");
  assert.equal(usersAfterCreate.body.success, true);
  assert.ok(usersAfterCreate.body.data);
  assert.ok(Array.isArray(usersAfterCreate.body.data.items));

  const createdUser = usersAfterCreate.body.data.items.find((item) => item.id === userId);
  assert.ok(createdUser);
  assert.equal(createdUser.email, userEmail);

  const updatedUserName = `${userName} (updated)`;
  const updatedUserEmail = `${userToken}-updated@example.com`.toLowerCase();

  const updateUserResult = await requestJson(
    "/api/users",
    "PUT",
    {
      id: userId,
      name: updatedUserName,
      email: updatedUserEmail,
      emailVerified: true,
      isActive: false,
      groupId,
    },
    context,
  );

  assert.equal(updateUserResult.response.status, 200, "PUT /api/users: esperado 200");
  assert.equal(updateUserResult.body.success, true);
  assert.ok(updateUserResult.body.data);

  const usersAfterUpdate = await request("/api/users", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(usersAfterUpdate.response.status, 200, "GET /api/users após PUT: esperado 200");
  assert.equal(usersAfterUpdate.body.success, true);
  assert.ok(usersAfterUpdate.body.data);

  const updatedUser = usersAfterUpdate.body.data.items.find((item) => item.id === userId);
  assert.ok(updatedUser);
  assert.equal(updatedUser.name, updatedUserName);
  assert.equal(updatedUser.email, updatedUserEmail);

  const deleteUserResult = await request(`/api/users?id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteUserResult.response.status, 200, "DELETE /api/users: esperado 200");
  assert.equal(deleteUserResult.body.success, true);

  const usersAfterDelete = await request("/api/users", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(usersAfterDelete.response.status, 200, "GET /api/users após DELETE: esperado 200");
  assert.equal(usersAfterDelete.body.success, true);
  assert.ok(usersAfterDelete.body.data);
  assert.ok(Array.isArray(usersAfterDelete.body.data.items));
  assert.ok(!usersAfterDelete.body.data.items.some((item) => item.id === userId));

  const deleteGroupResult = await request(`/api/groups?id=${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteGroupResult.response.status, 200, "DELETE /api/groups: esperado 200");
  assert.equal(deleteGroupResult.body.success, true);

  const groupsAfterDelete = await request("/api/groups?search=Smoke%20Group", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(groupsAfterDelete.response.status, 200, "GET /api/groups após DELETE: esperado 200");
  assert.equal(groupsAfterDelete.body.success, true);
  assert.ok(groupsAfterDelete.body.data);
  assert.ok(!groupsAfterDelete.body.data.items.some((item) => item.id === groupId));

  console.log("✓ POST/PUT/DELETE /api/groups, /api/groups/permissions e /api/users roundtrip");
}

async function runIncidentsAndMonitoringWriteRoundtrip(context) {
  const incidentToken = makeSmokeToken("incident");
  const incidentName = `Smoke Incident ${incidentToken}`;

  const createIncidentResult = await requestJson(
    "/api/incidents",
    "POST",
    {
      name: incidentName,
      color: "#6B7280",
    },
    context,
  );

  assert.equal(createIncidentResult.response.status, 200, "POST /api/incidents: esperado 200");
  assert.equal(createIncidentResult.body.success, true);
  assert.ok(createIncidentResult.body.data);

  const incidentId = createIncidentResult.body.data.id;
  assert.equal(typeof incidentId, "string");

  const incidentsAfterCreate = await request("/api/incidents", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(incidentsAfterCreate.response.status, 200, "GET /api/incidents após POST: esperado 200");
  assert.equal(incidentsAfterCreate.body.success, true);
  assert.ok(Array.isArray(incidentsAfterCreate.body.data));
  assert.ok(incidentsAfterCreate.body.data.some((item) => item.id === incidentId));

  const usageResult = await request(`/api/incidents/usage?incidentId=${encodeURIComponent(incidentId)}`, {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(usageResult.response.status, 200, "GET /api/incidents/usage: esperado 200");
  assert.equal(usageResult.body.success, true);
  assert.ok(usageResult.body.data);
  assert.equal(usageResult.body.data.inUse, false);
  assert.equal(usageResult.body.data.usageCount, 0);

  const updatedIncidentName = `${incidentName} (updated)`;
  const updateIncidentResult = await requestJson(
    "/api/incidents",
    "PUT",
    {
      id: incidentId,
      name: updatedIncidentName,
      color: "#8B5CF6",
    },
    context,
  );

  assert.equal(updateIncidentResult.response.status, 200, "PUT /api/incidents: esperado 200");
  assert.equal(updateIncidentResult.body.success, true);

  const incidentsAfterUpdate = await request("/api/incidents", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(incidentsAfterUpdate.response.status, 200, "GET /api/incidents após PUT: esperado 200");
  assert.equal(incidentsAfterUpdate.body.success, true);
  assert.ok(Array.isArray(incidentsAfterUpdate.body.data));

  const updatedIncident = incidentsAfterUpdate.body.data.find((item) => item.id === incidentId);
  assert.ok(updatedIncident);
  assert.equal(updatedIncident.name, updatedIncidentName);

  const incidentImageToken = makeSmokeToken("incident-image");
  const createIncidentImageResult = await requestJson(
    "/api/incidents/images",
    "POST",
    {
      image: TINY_PNG_BASE64,
      filename: `${incidentImageToken}.png`,
    },
    context,
  );

  assert.equal(createIncidentImageResult.response.status, 200, "POST /api/incidents/images: esperado 200");
  assert.equal(createIncidentImageResult.body.success, true);
  assert.ok(createIncidentImageResult.body.data);

  const incidentImageFilename = createIncidentImageResult.body.data.filename;
  assert.equal(typeof incidentImageFilename, "string");

  const incidentImagesAfterCreate = await request("/api/incidents/images", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(incidentImagesAfterCreate.response.status, 200, "GET /api/incidents/images após POST: esperado 200");
  assert.equal(incidentImagesAfterCreate.body.success, true);
  assert.ok(incidentImagesAfterCreate.body.data);
  assert.ok(Array.isArray(incidentImagesAfterCreate.body.data.items));
  assert.ok(incidentImagesAfterCreate.body.data.items.some((item) => item.filename === incidentImageFilename));

  const deleteIncidentImageResult = await request(`/api/incidents/images?filename=${encodeURIComponent(incidentImageFilename)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteIncidentImageResult.response.status, 200, "DELETE /api/incidents/images: esperado 200");
  assert.equal(deleteIncidentImageResult.body.success, true);

  const incidentImagesAfterDelete = await request("/api/incidents/images", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(incidentImagesAfterDelete.response.status, 200, "GET /api/incidents/images após DELETE: esperado 200");
  assert.equal(incidentImagesAfterDelete.body.success, true);
  assert.ok(incidentImagesAfterDelete.body.data);
  assert.ok(Array.isArray(incidentImagesAfterDelete.body.data.items));
  assert.ok(!incidentImagesAfterDelete.body.data.items.some((item) => item.filename === incidentImageFilename));

  const deleteIncidentResult = await request(`/api/incidents?id=${encodeURIComponent(incidentId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteIncidentResult.response.status, 200, "DELETE /api/incidents: esperado 200");
  assert.equal(deleteIncidentResult.body.success, true);

  const incidentsAfterDelete = await request("/api/incidents", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(incidentsAfterDelete.response.status, 200, "GET /api/incidents após DELETE: esperado 200");
  assert.equal(incidentsAfterDelete.body.success, true);
  assert.ok(Array.isArray(incidentsAfterDelete.body.data));
  assert.ok(!incidentsAfterDelete.body.data.some((item) => item.id === incidentId));

  const pageToken = makeSmokeToken("page");
  const pageName = `Smoke Picture Page ${pageToken}`;
  const picturePageResult = await requestJson(
    "/api/monitoring/picture-pages",
    "POST",
    {
      slug: `${pageToken}-page`,
      name: pageName,
      url: `https://example.com/${pageToken}`,
      description: `Smoke picture page ${pageToken}`,
    },
    context,
  );

  assert.equal(picturePageResult.response.status, 201, "POST /api/monitoring/picture-pages: esperado 201");
  assert.equal(picturePageResult.body.success, true);
  assert.ok(picturePageResult.body.data);

  const picturePageId = picturePageResult.body.data.id;
  assert.equal(typeof picturePageId, "string");

  const picturePagesAfterCreate = await request("/api/monitoring/picture-pages", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(picturePagesAfterCreate.response.status, 200, "GET /api/monitoring/picture-pages após POST: esperado 200");
  assert.equal(picturePagesAfterCreate.body.success, true);
  assert.ok(picturePagesAfterCreate.body.data);
  assert.ok(Array.isArray(picturePagesAfterCreate.body.data.items));
  assert.ok(picturePagesAfterCreate.body.data.items.some((item) => item.id === picturePageId));

  const updatedPageName = `${pageName} (updated)`;
  const pageUpdateResult = await requestJson(
    "/api/monitoring/picture-pages",
    "PUT",
    {
      id: picturePageId,
      slug: `${pageToken}-page-updated`,
      name: updatedPageName,
      url: `https://example.com/${pageToken}/updated`,
      description: `Smoke picture page ${pageToken} updated`,
    },
    context,
  );

  assert.equal(pageUpdateResult.response.status, 200, "PUT /api/monitoring/picture-pages: esperado 200");
  assert.equal(pageUpdateResult.body.success, true);

  const picturePagesAfterUpdate = await request("/api/monitoring/picture-pages", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(picturePagesAfterUpdate.response.status, 200, "GET /api/monitoring/picture-pages após PUT: esperado 200");
  assert.equal(picturePagesAfterUpdate.body.success, true);
  assert.ok(picturePagesAfterUpdate.body.data);
  assert.ok(Array.isArray(picturePagesAfterUpdate.body.data.items));

  const updatedPage = picturePagesAfterUpdate.body.data.items.find((item) => item.id === picturePageId);
  assert.ok(updatedPage);
  assert.equal(updatedPage.name, updatedPageName);

  const pictureLinkId = randomUUID();
  const pictureLinkResult = await requestJson(
    "/api/monitoring/picture-links",
    "PUT",
    {
      id: pictureLinkId,
      pageId: picturePageId,
      slug: `${pageToken}-link`,
      name: `Smoke Link ${pageToken}`,
      url: `https://example.com/${pageToken}/link`,
      size: "small",
    },
    context,
  );

  assert.equal(pictureLinkResult.response.status, 200, "PUT /api/monitoring/picture-links: esperado 200");
  assert.equal(pictureLinkResult.body.success, true);

  const pictureLinkUpdateResult = await requestJson(
    "/api/monitoring/picture-links",
    "PUT",
    {
      id: pictureLinkId,
      pageId: picturePageId,
      slug: `${pageToken}-link-updated`,
      name: `Smoke Link ${pageToken} updated`,
      url: `https://example.com/${pageToken}/link-updated`,
      size: "large",
    },
    context,
  );

  assert.equal(pictureLinkUpdateResult.response.status, 200, "PUT /api/monitoring/picture-links update: esperado 200");
  assert.equal(pictureLinkUpdateResult.body.success, true);

  const pictureLinkDeleteResult = await request(`/api/monitoring/picture-links?id=${encodeURIComponent(pictureLinkId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(pictureLinkDeleteResult.response.status, 200, "DELETE /api/monitoring/picture-links: esperado 200");
  assert.equal(pictureLinkDeleteResult.body.success, true);

  const radarGroupId = randomUUID();
  const radarGroupToken = makeSmokeToken("radar-group");
  const createRadarGroupResult = await requestJson(
    "/api/monitoring/radar-groups",
    "POST",
    {
      id: radarGroupId,
      slug: `${radarGroupToken}-group`,
      name: `Smoke Radar Group ${radarGroupToken}`,
      sortOrder: 77,
    },
    context,
  );

  assert.equal(createRadarGroupResult.response.status, 201, "POST /api/monitoring/radar-groups: esperado 201");
  assert.equal(createRadarGroupResult.body.success, true);

  const radarGroupsAfterCreate = await request("/api/monitoring/radar-groups", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarGroupsAfterCreate.response.status, 200, "GET /api/monitoring/radar-groups após POST: esperado 200");
  assert.equal(radarGroupsAfterCreate.body.success, true);
  assert.ok(radarGroupsAfterCreate.body.data);
  assert.ok(Array.isArray(radarGroupsAfterCreate.body.data.items));
  assert.ok(radarGroupsAfterCreate.body.data.items.some((item) => item.id === radarGroupId));

  const updateRadarGroupResult = await requestJson(
    "/api/monitoring/radar-groups",
    "PUT",
    {
      id: radarGroupId,
      slug: `${radarGroupToken}-group-updated`,
      name: `Smoke Radar Group ${radarGroupToken} updated`,
      sortOrder: 78,
    },
    context,
  );

  assert.equal(updateRadarGroupResult.response.status, 200, "PUT /api/monitoring/radar-groups: esperado 200");
  assert.equal(updateRadarGroupResult.body.success, true);

  const radarGroupsAfterUpdate = await request("/api/monitoring/radar-groups", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarGroupsAfterUpdate.response.status, 200, "GET /api/monitoring/radar-groups após PUT: esperado 200");
  assert.equal(radarGroupsAfterUpdate.body.success, true);
  assert.ok(radarGroupsAfterUpdate.body.data);
  assert.ok(Array.isArray(radarGroupsAfterUpdate.body.data.items));

  const updatedRadarGroup = radarGroupsAfterUpdate.body.data.items.find((item) => item.id === radarGroupId);
  assert.ok(updatedRadarGroup);
  assert.equal(updatedRadarGroup.name, `Smoke Radar Group ${radarGroupToken} updated`);

  const radarId = randomUUID();
  const radarToken = makeSmokeToken("radar");
  const createRadarResult = await requestJson(
    "/api/monitoring/radars",
    "PUT",
    {
      id: radarId,
      slug: `${radarToken}-radar`,
      groupId: radarGroupId,
      name: `Smoke Radar ${radarToken}`,
      description: `Smoke radar ${radarToken}`,
      webhookUrl: `https://example.com/${radarToken}/webhook`,
      logUrl: `https://example.com/${radarToken}/logs`,
      active: true,
    },
    context,
  );

  assert.equal(createRadarResult.response.status, 200, "PUT /api/monitoring/radars create: esperado 200");
  assert.equal(createRadarResult.body.success, true);

  const radarsAfterCreate = await request("/api/monitoring/radars", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarsAfterCreate.response.status, 200, "GET /api/monitoring/radars após PUT: esperado 200");
  assert.equal(radarsAfterCreate.body.success, true);
  assert.ok(radarsAfterCreate.body.data);
  assert.ok(Array.isArray(radarsAfterCreate.body.data.items));
  assert.ok(radarsAfterCreate.body.data.items.some((item) => item.id === radarId));

  const updateRadarResult = await requestJson(
    "/api/monitoring/radars",
    "PUT",
    {
      id: radarId,
      slug: `${radarToken}-radar-updated`,
      groupId: radarGroupId,
      name: `Smoke Radar ${radarToken} updated`,
      description: `Smoke radar ${radarToken} updated`,
      webhookUrl: `https://example.com/${radarToken}/webhook-updated`,
      logUrl: `https://example.com/${radarToken}/logs-updated`,
      active: false,
    },
    context,
  );

  assert.equal(updateRadarResult.response.status, 200, "PUT /api/monitoring/radars update: esperado 200");
  assert.equal(updateRadarResult.body.success, true);

  const radarsAfterUpdate = await request("/api/monitoring/radars", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarsAfterUpdate.response.status, 200, "GET /api/monitoring/radars após update: esperado 200");
  assert.equal(radarsAfterUpdate.body.success, true);
  assert.ok(radarsAfterUpdate.body.data);
  assert.ok(Array.isArray(radarsAfterUpdate.body.data.items));

  const updatedRadar = radarsAfterUpdate.body.data.items.find((item) => item.id === radarId);
  assert.ok(updatedRadar);
  assert.equal(updatedRadar.name, `Smoke Radar ${radarToken} updated`);
  assert.equal(updatedRadar.active, false);

  const deleteRadarResult = await request(`/api/monitoring/radars?id=${encodeURIComponent(radarId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteRadarResult.response.status, 200, "DELETE /api/monitoring/radars: esperado 200");
  assert.equal(deleteRadarResult.body.success, true);

  const radarsAfterDelete = await request("/api/monitoring/radars", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarsAfterDelete.response.status, 200, "GET /api/monitoring/radars após DELETE: esperado 200");
  assert.equal(radarsAfterDelete.body.success, true);
  assert.ok(radarsAfterDelete.body.data);
  assert.ok(Array.isArray(radarsAfterDelete.body.data.items));
  assert.ok(!radarsAfterDelete.body.data.items.some((item) => item.id === radarId));

  const deleteRadarGroupResult = await request(`/api/monitoring/radar-groups?id=${encodeURIComponent(radarGroupId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deleteRadarGroupResult.response.status, 200, "DELETE /api/monitoring/radar-groups: esperado 200");
  assert.equal(deleteRadarGroupResult.body.success, true);

  const radarGroupsAfterDelete = await request("/api/monitoring/radar-groups", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(radarGroupsAfterDelete.response.status, 200, "GET /api/monitoring/radar-groups após DELETE: esperado 200");
  assert.equal(radarGroupsAfterDelete.body.success, true);
  assert.ok(radarGroupsAfterDelete.body.data);
  assert.ok(Array.isArray(radarGroupsAfterDelete.body.data.items));
  assert.ok(!radarGroupsAfterDelete.body.data.items.some((item) => item.id === radarGroupId));

  const deletePicturePageResult = await request(`/api/monitoring/picture-pages?id=${encodeURIComponent(picturePageId)}`, {
    method: "DELETE",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(deletePicturePageResult.response.status, 200, "DELETE /api/monitoring/picture-pages: esperado 200");
  assert.equal(deletePicturePageResult.body.success, true);

  const picturePagesAfterDelete = await request("/api/monitoring/picture-pages", {
    method: "GET",
    headers: context.cookie ? { cookie: context.cookie } : undefined,
  });

  assert.equal(picturePagesAfterDelete.response.status, 200, "GET /api/monitoring/picture-pages após DELETE: esperado 200");
  assert.equal(picturePagesAfterDelete.body.success, true);
  assert.ok(picturePagesAfterDelete.body.data);
  assert.ok(Array.isArray(picturePagesAfterDelete.body.data.items));
  assert.ok(!picturePagesAfterDelete.body.data.items.some((item) => item.id === picturePageId));

  console.log("✓ POST/PUT/DELETE /api/incidents e /api/monitoring/* roundtrip");
}

async function loadTaskFixture() {
  return withDatabaseClient(async (client) => {
    const taskResult = await client.query(`
      select t.id, t.project_id, t.name
      from project_task t
      left join project_task_user u on u.task_id = t.id
      group by t.id, t.project_id, t.name, t.created_at
      order by count(u.user_id) desc, t.created_at desc
      limit 1
    `);

    const task = taskResult.rows[0];
    assert.ok(task, "Não foi possível encontrar uma tarefa para o smoke de tasks.");

    const assignmentsResult = await client.query(
      `
        select id, task_id, user_id, role, assigned_at, created_at
        from project_task_user
        where task_id = $1
        order by assigned_at asc
      `,
      [task.id],
    );

    const activeUsersResult = await client.query(
      `
        select id, name, email
        from "user"
        where is_active = true
        order by created_at asc
      `,
    );

    return {
      task: {
        id: task.id,
        projectId: task.project_id,
        name: task.name,
      },
      assignments: assignmentsResult.rows,
      activeUsers: activeUsersResult.rows,
    };
  });
}

async function restoreTaskAssignments(taskId, assignments) {
  await withDatabaseClient(async (client) => {
    await client.query("BEGIN");

    try {
      await client.query("DELETE FROM project_task_user WHERE task_id = $1", [taskId]);

      if (assignments.length > 0) {
        const valueFragments = [];
        const values = [];

        for (const assignment of assignments) {
          const baseIndex = values.length + 1;
          valueFragments.push(
            `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`,
          );
          values.push(
            assignment.id,
            assignment.task_id,
            assignment.user_id,
            assignment.role,
            assignment.assigned_at,
            assignment.created_at,
          );
        }

        await client.query(
          `
            INSERT INTO project_task_user (id, task_id, user_id, role, assigned_at, created_at)
            VALUES ${valueFragments.join(", ")}
          `,
          values,
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function runTasksWriteRoundtrip(context) {
  const fixture = await loadTaskFixture();
  const originalAssignments = fixture.assignments;
  const originalUserIds = new Set(originalAssignments.map((assignment) => assignment.user_id));
  const replacementUsers = fixture.activeUsers.filter((user) => !originalUserIds.has(user.id));

  assert.ok(replacementUsers.length > 0, "Não há usuários ativos suficientes para testar a troca de usuários da tarefa.");

  const replacementUserIds = replacementUsers.slice(0, 2).map((user) => user.id);
  assert.ok(replacementUserIds.length > 0, "Não foi possível selecionar usuários substitutos para a tarefa.");

  try {
    const historyBefore = await request(`/api/tasks/${encodeURIComponent(fixture.task.id)}/history`, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(historyBefore.response.status, 200, "GET /api/tasks/:taskId/history: esperado 200");
    assert.equal(historyBefore.body.success, true);
    assert.ok(historyBefore.body.data);
    assert.ok(Array.isArray(historyBefore.body.data.history));

    const usersBefore = await request(`/api/tasks/${encodeURIComponent(fixture.task.id)}/users`, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(usersBefore.response.status, 200, "GET /api/tasks/:taskId/users antes da troca: esperado 200");
    assert.equal(usersBefore.body.success, true);
    assert.ok(Array.isArray(usersBefore.body.data));
    assert.equal(usersBefore.body.data.length, originalAssignments.length);

    const setUsersResult = await requestJson(
      `/api/tasks/${encodeURIComponent(fixture.task.id)}/users`,
      "POST",
      {
        userIds: replacementUserIds,
        role: "reviewer",
      },
      context,
    );

    assert.equal(setUsersResult.response.status, 200, "POST /api/tasks/:taskId/users: esperado 200");
    assert.equal(setUsersResult.body.success, true);

    const usersAfter = await request(`/api/tasks/${encodeURIComponent(fixture.task.id)}/users`, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(usersAfter.response.status, 200, "GET /api/tasks/:taskId/users após POST: esperado 200");
    assert.equal(usersAfter.body.success, true);
    assert.ok(Array.isArray(usersAfter.body.data));
    assert.equal(usersAfter.body.data.length, replacementUserIds.length);
    assert.ok(usersAfter.body.data.every((item) => replacementUserIds.includes(item.id)));
    assert.ok(usersAfter.body.data.every((item) => item.role === "reviewer"));

    const historyAfter = await request(`/api/tasks/${encodeURIComponent(fixture.task.id)}/history`, {
      method: "GET",
      headers: context.cookie ? { cookie: context.cookie } : undefined,
    });

    assert.equal(historyAfter.response.status, 200, "GET /api/tasks/:taskId/history após POST: esperado 200");
    assert.equal(historyAfter.body.success, true);
    assert.ok(historyAfter.body.data);
    assert.ok(Array.isArray(historyAfter.body.data.history));

    console.log("✓ GET /api/tasks/:taskId/history, GET/POST /api/tasks/:taskId/users roundtrip");
  } finally {
    await restoreTaskAssignments(fixture.task.id, originalAssignments);
  }
}

async function loadAuthVerificationCode(email) {
  return withDatabaseClient(async (client) => {
    const result = await client.query(
      `
        select identifier, value
        from verification
        where identifier ilike $1
          and identifier not ilike '%attempts:%'
        order by created_at desc nulls last, expires_at desc
        limit 1
      `,
      [`%${email}%`],
    );

    const row = result.rows[0];
    assert.ok(row, `Não foi possível recuperar o código de autenticação para ${email}.`);

    const code = String(row.value).split(":")[0]?.trim() ?? "";
    assert.match(code, /^\d{6}$/, `OTP inválido para ${email}.`);

    return { code, identifier: row.identifier };
  });
}

async function cleanupAuthSmokeUser(email) {
  await withDatabaseClient(async (client) => {
    await client.query("BEGIN");

    try {
      const userResult = await client.query('select id from "user" where email = $1', [email]);
      const userId = userResult.rows[0]?.id;

      if (userId) {
        await client.query("DELETE FROM session WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM account WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM user_group WHERE user_id = $1", [userId]);
        await client.query("DELETE FROM rate_limit WHERE email = $1", [email]);
        await client.query("DELETE FROM verification WHERE identifier ILIKE $1", [`%${email}%`]);
        await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
      } else {
        await client.query("DELETE FROM rate_limit WHERE email = $1", [email]);
        await client.query("DELETE FROM verification WHERE identifier ILIKE $1", [`%${email}%`]);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function runAuthCustomWriteRoundtrip() {
  const email = `smoke-${randomUUID().slice(0, 8)}@inpe.br`;
  const initialPassword = "Smoke!1234Aa";
  const resetPassword = "Smoke!5678Bb";
  const anonymousContext = { cookie: "" };

  try {
    const signUpResult = await requestJson(
      "/api/auth/sign-up/email",
      "POST",
      {
        name: "Smoke Auth",
        email,
        password: initialPassword,
      },
      anonymousContext,
    );

    assert.equal(signUpResult.response.status, 201, "POST /api/auth/sign-up/email: esperado 201");
    assert.equal(signUpResult.body.success, true);
    assert.equal(signUpResult.body.data.cooldownSeconds, 90);
    assert.equal(signUpResult.body.message, "Conta criada com sucesso. Verifique seu e-mail.");

    const signUpResendResult = await requestJson(
      "/api/auth/sign-up/email/send-otp",
      "POST",
      {
        email,
        resend: true,
      },
      anonymousContext,
    );

    assert.equal(signUpResendResult.response.status, 200, "POST /api/auth/sign-up/email/send-otp: esperado 200");
    assert.equal(signUpResendResult.body.success, true);
    assert.equal(signUpResendResult.body.data.cooldownSeconds, 90);
    assert.equal(signUpResendResult.body.message, "Código reenviado para seu e-mail.");

    const signUpOtp = await loadAuthVerificationCode(email);
    const verifySignUpResult = await requestJson(
      "/api/auth/sign-up/email/verify-otp",
      "POST",
      {
        email,
        code: signUpOtp.code,
        password: initialPassword,
        autoSignIn: true,
      },
      anonymousContext,
    );

    assert.equal(verifySignUpResult.response.status, 200, "POST /api/auth/sign-up/email/verify-otp: esperado 200");
    assert.equal(verifySignUpResult.body.success, true);
    assert.equal(verifySignUpResult.body.data.success, true);
    assert.equal(verifySignUpResult.body.data.signedIn, true);
    assert.equal(verifySignUpResult.body.message, "Conta verificada com sucesso.");

    const signUpCookie = cookieHeaderFromSetCookie(getSetCookieHeaders(verifySignUpResult.response.headers));
    assert.ok(signUpCookie.length > 0, "POST /api/auth/sign-up/email/verify-otp: cookie de sessão ausente.");

    const signUpSession = await request("/api/auth/get-session", {
      method: "GET",
      headers: { cookie: signUpCookie },
    });

    assert.equal(signUpSession.response.status, 200, "GET /api/auth/get-session após sign-up: esperado 200");
    assert.equal(typeof signUpSession.body, "object");
    assert.ok(signUpSession.body !== null);

    const loginEmailSendResult = await requestJson(
      "/api/auth/login-email/send-otp",
      "POST",
      {
        email,
      },
      anonymousContext,
    );

    assert.equal(loginEmailSendResult.response.status, 200, "POST /api/auth/login-email/send-otp: esperado 200");
    assert.equal(loginEmailSendResult.body.success, true);
    assert.equal(loginEmailSendResult.body.data.cooldownSeconds, 90);
    assert.equal(loginEmailSendResult.body.message, "Código enviado para seu e-mail.");

    const loginEmailOtp = await loadAuthVerificationCode(email);
    const verifyLoginEmailResult = await requestJson(
      "/api/auth/login-email/verify-otp",
      "POST",
      {
        email,
        code: loginEmailOtp.code,
      },
      anonymousContext,
    );

    assert.equal(verifyLoginEmailResult.response.status, 200, "POST /api/auth/login-email/verify-otp: esperado 200");
    assert.equal(verifyLoginEmailResult.body.success, true);
    assert.equal(verifyLoginEmailResult.body.data.signedIn, true);
    assert.equal(verifyLoginEmailResult.body.message, "Login realizado com sucesso!");

    const loginEmailCookie = cookieHeaderFromSetCookie(getSetCookieHeaders(verifyLoginEmailResult.response.headers));
    assert.ok(loginEmailCookie.length > 0, "POST /api/auth/login-email/verify-otp: cookie de sessão ausente.");

    const loginEmailSession = await request("/api/auth/get-session", {
      method: "GET",
      headers: { cookie: loginEmailCookie },
    });

    assert.equal(loginEmailSession.response.status, 200, "GET /api/auth/get-session após login-email: esperado 200");
    assert.equal(typeof loginEmailSession.body, "object");
    assert.ok(loginEmailSession.body !== null);

    const forgetPasswordSendResult = await requestJson(
      "/api/auth/forget-password",
      "POST",
      {
        email,
      },
      anonymousContext,
    );

    assert.equal(forgetPasswordSendResult.response.status, 200, "POST /api/auth/forget-password: esperado 200");
    assert.equal(forgetPasswordSendResult.body.success, true);
    assert.equal(forgetPasswordSendResult.body.data.step, 2);
    assert.equal(forgetPasswordSendResult.body.data.email, email);

    const forgetPasswordOtp = await loadAuthVerificationCode(email);
    const setupPasswordResult = await requestJson(
      "/api/auth/setup-password",
      "POST",
      {
        email,
        code: forgetPasswordOtp.code,
        password: resetPassword,
        autoSignIn: true,
      },
      anonymousContext,
    );

    assert.equal(setupPasswordResult.response.status, 200, "POST /api/auth/setup-password: esperado 200");
    assert.equal(setupPasswordResult.body.success, true);
    assert.equal(setupPasswordResult.body.data.signedIn, true);
    assert.equal(setupPasswordResult.body.message, "Senha definida com sucesso.");

    const setupPasswordCookie = cookieHeaderFromSetCookie(getSetCookieHeaders(setupPasswordResult.response.headers));
    assert.ok(setupPasswordCookie.length > 0, "POST /api/auth/setup-password: cookie de sessão ausente.");

    const setupPasswordSession = await request("/api/auth/get-session", {
      method: "GET",
      headers: { cookie: setupPasswordCookie },
    });

    assert.equal(setupPasswordSession.response.status, 200, "GET /api/auth/get-session após setup-password: esperado 200");
    assert.equal(typeof setupPasswordSession.body, "object");
    assert.ok(setupPasswordSession.body !== null);

    const passwordLoginResult = await requestJson(
      "/api/auth/login/password",
      "POST",
      {
        email,
        password: resetPassword,
      },
      anonymousContext,
    );

    assert.equal(passwordLoginResult.response.status, 200, "POST /api/auth/login/password após reset: esperado 200");
    assert.equal(passwordLoginResult.body.success, true);
    assert.equal(passwordLoginResult.body.data.signedIn, true);
    assert.equal(passwordLoginResult.body.message, "Login realizado com sucesso!");

    const passwordLoginCookie = cookieHeaderFromSetCookie(getSetCookieHeaders(passwordLoginResult.response.headers));
    assert.ok(passwordLoginCookie.length > 0, "POST /api/auth/login/password após reset: cookie de sessão ausente.");

    const passwordLoginSession = await request("/api/auth/get-session", {
      method: "GET",
      headers: { cookie: passwordLoginCookie },
    });

    assert.equal(passwordLoginSession.response.status, 200, "GET /api/auth/get-session após login/password: esperado 200");
    assert.equal(typeof passwordLoginSession.body, "object");
    assert.ok(passwordLoginSession.body !== null);

    const loginGoogleResult = await request("/api/auth/login-google?from=login", {
      method: "GET",
      redirect: "manual",
    });

    if (loginGoogleResult.response.status === 302 || loginGoogleResult.response.status === 303) {
      assert.ok(
        loginGoogleResult.response.status === 302 || loginGoogleResult.response.status === 303,
        "GET /api/auth/login-google: esperado redirecionamento quando Google está configurado.",
      );
      assert.ok(
        (loginGoogleResult.response.headers.get("location") ?? "").length > 0,
        "GET /api/auth/login-google: location ausente no redirecionamento.",
      );
    } else if (loginGoogleResult.response.status === 404) {
      assert.equal(loginGoogleResult.body.code, "PROVIDER_NOT_FOUND");
      assert.equal(loginGoogleResult.body.message, "Provider not found");
    } else {
      assert.equal(loginGoogleResult.response.status, 503, "GET /api/auth/login-google sem Google: esperado 503");
      assert.equal(loginGoogleResult.body.success, false);
      assert.equal(loginGoogleResult.body.error, "Login com Google indisponível neste ambiente.");
    }

    console.log("✓ auth-custom: sign-up, login-email, reset de senha e login-google validados");
  } finally {
    await cleanupAuthSmokeUser(email);
  }
}

async function main() {
  if (inventoryOnly) {
    printInventory();
    return;
  }

  const context = {
    baseUrl,
    email,
    password,
    cookie: cookieOverride,
    isAdminExpected: expectAdmin,
  };

  console.log(`Smoke da API: ${baseUrl.toString()}`);

  for (const check of publicChecks) {
    await runCheck(check, context);
  }

  let sessionCookie = cookieOverride ?? "";

  if (!sessionCookie) {
    if (email && password) {
      const loginResult = await runCheck(authChecks[0], context);
      const setCookies = getSetCookieHeaders(loginResult.response.headers);
      sessionCookie = cookieHeaderFromSetCookie(setCookies);

      assert.ok(
        sessionCookie.length > 0,
        "Login realizado, mas nenhum cookie de sessão foi retornado.",
      );
      context.cookie = sessionCookie;

      for (const check of authChecks.slice(1)) {
        await runCheck(check, context);
      }
    } else {
      console.log("↷ Checks autenticados ignorados: forneça API_SMOKE_EMAIL e API_SMOKE_PASSWORD para habilitar login.");
    }
  } else if (email && password) {
    console.log("↷ Cookie fornecido; login por credencial ignorado.");
  } else {
    console.log("↷ Checks autenticados executados apenas com o cookie informado.");
  }

  if (expectAdmin) {
    if (!context.cookie) {
      throw new Error("API_SMOKE_EXPECT_ADMIN=true exige cookie autenticado ou credenciais válidas.");
    }

    for (const check of adminChecks) {
      await runCheck(check, context);
    }

    await runUploadRoundtrip(context);
    await runProductsExtendedChecks(context);
    await runProjectsWriteRoundtrip(context);
    await runGroupsAndUsersWriteRoundtrip(context);
    await runIncidentsAndMonitoringWriteRoundtrip(context);
    await runTasksWriteRoundtrip(context);
    await runAuthCustomWriteRoundtrip();
  } else {
    console.log("↷ Checks administrativos ignorados: use --expect-admin ou API_SMOKE_EXPECT_ADMIN=true para validar CRUD admin.");
  }

  console.log("Smoke concluído com sucesso.");
}

main().catch((error) => {
  console.error("Smoke falhou:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});