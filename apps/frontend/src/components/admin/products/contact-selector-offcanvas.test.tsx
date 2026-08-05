import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import ContactSelectorOffcanvas from "./contact-selector-offcanvas";

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

function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string") {
    throw new Error("Expected JSON string body");
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function createContactSelectorFetchMock() {
  const activeContactsPathname = new URL(
    config.getApiUrl("/api/admin/contacts?status=active"),
    "http://localhost",
  ).pathname;
  const associationsPathname = new URL(
    config.getApiUrl("/api/admin/products/contacts"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname === activeContactsPathname) {
      expect(method).toBe("GET");
      return jsonResponse({
        success: true,
        data: {
          items: [
            {
              id: "contact-1",
              name: "Contato Alfa",
              role: "Pesquisador",
              team: "Meteorologia",
              email: "alfa@example.com",
              phone: null,
              image: null,
              active: true,
            },
            {
              id: "contact-2",
              name: "Contato Beta",
              role: "Coordenador",
              team: "Observação",
              email: "beta@example.com",
              phone: null,
              image: null,
              active: true,
            },
          ],
        },
      });
    }

    if (requestUrl.pathname === associationsPathname && requestUrl.searchParams.has("productId")) {
      expect(method).toBe("GET");
      expect(requestUrl.searchParams.get("productId")).toBe("product-1");
      return jsonResponse({ success: true, data: { contacts: [] } });
    }

    if (requestUrl.pathname === associationsPathname) {
      expect(method).toBe("POST");
      expect(parseJsonBody(init?.body)).toEqual({
        productId: "product-1",
        contactIds: ["contact-1", "contact-2"],
      });
      return jsonResponse({ success: true, message: "Contatos atualizados" });
    }

    throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
  });

  return { fetchMock };
}

describe("ContactSelectorOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads contacts and saves the selection through the JSON API contract", async () => {
    const { fetchMock } = createContactSelectorFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ContactSelectorOffcanvas
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        productId="product-1"
      />,
    );

    await screen.findByText("Contato Alfa");
    await screen.findByText("Contato Beta");

    fireEvent.click(screen.getByRole("button", { name: /selecionar todos/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar \(2\)/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});