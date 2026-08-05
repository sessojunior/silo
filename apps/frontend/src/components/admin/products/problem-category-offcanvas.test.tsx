import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import ProblemCategoryOffcanvas from "./problem-category-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

interface DialogMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
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

vi.mock("@/components/ui/dialog", () => ({
  default: function MockDialog({ open, title, children, onClose }: DialogMockProps) {
    if (!open) {
      return null;
    }

    const accessibleName = typeof title === "string" ? title : undefined;

    return (
      <section role="dialog" aria-label={accessibleName}>
        <div>{title}</div>
        <div>{children}</div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </section>
    );
  },
}));

vi.mock("@/components/admin/products/problem-category-form-offcanvas", () => ({
  default: function MockProblemCategoryFormOffcanvas() {
    return null;
  },
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
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

function createProblemCategoryFetchMock() {
  const categoriesPathname = new URL(
    config.getApiUrl("/api/admin/products/problems/categories"),
    "http://localhost",
  ).pathname;
  const usagePathname = new URL(
    config.getApiUrl("/api/admin/incidents/usage?incidentId=category-1"),
    "http://localhost",
  ).pathname;

  let categories = [
    {
      id: "category-1",
      name: "Rede Externa",
      color: "#2563eb",
      isSystem: false,
      usageCount: 0,
    },
  ];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname === categoriesPathname) {
      if (method === "GET") {
        return jsonResponse({ data: categories });
      }

      if (method === "DELETE") {
        expect(requestUrl.searchParams.get("id")).toBe("category-1");
        categories = [];
        return jsonResponse({ success: true, message: "Categoria excluída" });
      }
    }

    if (requestUrl.pathname === usagePathname) {
      expect(method).toBe("GET");
      expect(requestUrl.searchParams.get("incidentId")).toBe("category-1");
      return jsonResponse({ success: true, data: { usageCount: 0 } });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return { fetchMock };
}

describe("ProblemCategoryOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads categories and deletes one through the query-string API contract", async () => {
    const { fetchMock } = createProblemCategoryFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemCategoryOffcanvas open onClose={vi.fn()} />);

    await screen.findByText("Rede Externa");

    fireEvent.click(screen.getByTitle("Excluir"));

    const dialog = await screen.findByRole("dialog", { name: "Excluir categoria" });
    fireEvent.click(within(dialog).getByRole("button", { name: /excluir/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        config.getApiUrl("/api/admin/products/problems/categories?id=category-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Rede Externa")).not.toBeInTheDocument();
    });
  });
});