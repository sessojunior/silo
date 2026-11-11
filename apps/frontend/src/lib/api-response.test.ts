import { describe, expect, it } from "vitest";
import { z } from "zod";

import { errorResponse, parseRequestJson, parseRequestQuery } from "./api-response";

describe("api-response helpers", () => {
  it("preserves HTTP status, field and data for authorization errors", async () => {
    const response = errorResponse("Acesso negado.", 403, {
      field: "projectId",
      reason: "missing_permission",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Acesso negado.",
      field: "projectId",
      data: {
        field: "projectId",
        reason: "missing_permission",
      },
    });
  });

  it("converts invalid JSON and schema violations into recoverable 400 responses", async () => {
    const schema = z.object({ name: z.string().min(1, "Nome obrigatório") });

    const invalidJson = await parseRequestJson(
      new Request("http://localhost/api", { body: "{", method: "POST" }),
      schema,
    );
    expect(invalidJson.ok).toBe(false);
    if (!invalidJson.ok) {
      expect(invalidJson.response.status).toBe(400);
    }

    const invalidSchema = await parseRequestJson(
      new Request("http://localhost/api", {
        body: JSON.stringify({ name: "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      schema,
    );
    expect(invalidSchema.ok).toBe(false);
    if (!invalidSchema.ok) {
      expect(invalidSchema.response.status).toBe(400);
      await expect(invalidSchema.response.json()).resolves.toMatchObject({
        success: false,
        field: "name",
      });
    }
  });

  it("accepts repeated query parameters as arrays", () => {
    const result = parseRequestQuery(
      new Request("http://localhost/api?status=active&status=paused"),
      z.object({ status: z.array(z.string()).or(z.string()) }),
    );

    expect(result).toEqual({ ok: true, data: { status: ["active", "paused"] } });
  });
});
