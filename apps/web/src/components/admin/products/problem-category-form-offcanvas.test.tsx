import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import ProblemCategoryFormOffcanvas from "./problem-category-form-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    title,
    children,
    footerActions,
    onClose,
  }: OffcanvasMockProps) {
    if (!open) {
      return null;
    }

    const accessibleName = typeof title === "string" ? title : undefined;

    return (
      <section role="dialog" aria-label={accessibleName}>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footerActions}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    );
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function createCategoryFetchMock(expectedMethod: "POST" | "PUT") {
  const categoriesPathname = new URL(
    config.getApiUrl("/api/admin/products/problems/categories"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    expect(requestUrl.pathname).toBe(categoriesPathname);
    expect(method).toBe(expectedMethod);

    return jsonResponse({ success: true, message: "Categoria salva com sucesso" });
  });

  return { fetchMock };
}

describe("ProblemCategoryFormOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a category through the JSON API contract", async () => {
    const { fetchMock } = createCategoryFetchMock("POST");
    const onClose = vi.fn();
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemCategoryFormOffcanvas open onClose={onClose} onSaved={onSaved} />);

    fireEvent.change(screen.getByPlaceholderText("Rede externa"), {
      target: { value: "Rede Externa" },
    });

    const colorInput = document.querySelector<HTMLInputElement>("input[type='color']");
    expect(colorInput).not.toBeNull();
    fireEvent.change(colorInput as HTMLInputElement, {
      target: { value: "#2563EB" },
    });

    fireEvent.click(screen.getByRole("button", { name: /cadastrar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Rede Externa",
      color: "#2563eb",
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates a category through the JSON API contract", async () => {
    const { fetchMock } = createCategoryFetchMock("PUT");
    const onClose = vi.fn();
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProblemCategoryFormOffcanvas
        open
        onClose={onClose}
        onSaved={onSaved}
        category={{ id: "category-1", name: "Rede Externa", color: "#64748B" }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Rede externa"), {
      target: { value: "Rede Externa Ajustada" },
    });

    const colorInput = document.querySelector<HTMLInputElement>("input[type='color']");
    expect(colorInput).not.toBeNull();
    fireEvent.change(colorInput as HTMLInputElement, {
      target: { value: "#7C3AED" },
    });

    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(JSON.parse(String(init?.body))).toEqual({
      id: "category-1",
      name: "Rede Externa Ajustada",
      color: "#7c3aed",
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});