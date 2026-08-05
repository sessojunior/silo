import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import { SHIFT_CODES } from "@silo/engine/domain/scheduling";
import SettingsProductsPage from "./page";

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

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

interface SelectMockProps {
  id?: string;
  name: string;
  selected?: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

vi.mock("@/components/ui/select", () => ({
  default: function MockSelect({
    id,
    name,
    selected,
    options,
    placeholder,
    onChange,
  }: SelectMockProps) {
    return (
      <select
        id={id}
        name={name}
        value={selected ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
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
  default: function MockDialog({
    open,
    title,
    children,
    onClose,
  }: DialogMockProps) {
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

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  available: boolean;
  turns: string[];
  priority: "low" | "normal" | "high" | "urgent";
  description: string | null;
  url_product_flow?: string | null;
};

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

function createProductsFetchMock(initialProducts: ProductRecord[]) {
  const productsPathname = new URL(
    config.getApiUrl("/api/admin/products"),
    "http://localhost",
  ).pathname;

  let products = initialProducts.map((product) => ({ ...product }));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname !== productsPathname) {
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    }

    if (method === "GET") {
      return jsonResponse({ success: true, data: { items: products } });
    }

    if (method === "POST") {
      const body = parseJsonBody(init?.body);
      const nextProduct: ProductRecord = {
        id: `product-${products.length + 1}`,
        name: String(body.name),
        slug: String(body.slug),
        available: Boolean(body.available),
        turns: Array.isArray(body.turns) ? body.turns.map(String) : [],
        priority: body.priority as ProductRecord["priority"],
        description: body.description === null ? null : String(body.description),
        url_product_flow:
          body.url_product_flow === null || body.url_product_flow === undefined
            ? null
            : String(body.url_product_flow),
      };

      products = [...products, nextProduct];
      return jsonResponse({ success: true, message: "Produto criado com sucesso" }, 201);
    }

    if (method === "PUT") {
      const body = parseJsonBody(init?.body);
      const updatedId = String(body.id);

      products = products.map((product) =>
        product.id === updatedId
          ? {
              ...product,
              name: String(body.name),
              slug: String(body.slug),
              available: Boolean(body.available),
              turns: Array.isArray(body.turns) ? body.turns.map(String) : [],
              priority: body.priority as ProductRecord["priority"],
              description: body.description === null ? null : String(body.description),
              url_product_flow:
                body.url_product_flow === null || body.url_product_flow === undefined
                  ? null
                  : String(body.url_product_flow),
            }
          : product,
      );

      return jsonResponse({ success: true, message: "Produto atualizado com sucesso" });
    }

    if (method === "DELETE") {
      const id = requestUrl.searchParams.get("id");

      products = products.filter((product) => product.id !== id);
      return jsonResponse({ success: true, message: "Produto excluído com sucesso" });
    }

    throw new Error(`Unexpected method: ${method}`);
  });

  return {
    fetchMock,
    getProducts: () => products,
  };
}

const initialProduct: ProductRecord = {
  id: "product-1",
  name: "Produto Alfa",
  slug: "produto-alfa",
  available: true,
  turns: [...SHIFT_CODES],
  priority: "normal",
  description: null,
  url_product_flow: null,
};

describe("SettingsProductsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the product list from the admin API path", async () => {
    const { fetchMock } = createProductsFetchMock([initialProduct]);
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsProductsPage />);

    await screen.findByText("Produto Alfa");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      config.getApiUrl("/api/admin/products?page=1&limit=1000"),
    );
  });

  it("creates a product through the form", async () => {
    const { fetchMock, getProducts } = createProductsFetchMock([initialProduct]);
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsProductsPage />);
    await screen.findByText("Produto Alfa");

    fireEvent.click(screen.getByRole("button", { name: /novo produto/i }));

    const dialog = await screen.findByRole("dialog", { name: /novo produto/i });
    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Produto Beta" },
    });
    fireEvent.change(within(dialog).getByLabelText("Slug"), {
      target: { value: "produto-beta" },
    });
    fireEvent.change(within(dialog).getByLabelText("Descrição"), {
      target: { value: "Produto usado para validar o create." },
    });
    fireEvent.change(
      within(dialog).getByLabelText("URL do Fluxo de Dados (opcional)"),
      {
        target: { value: "https://example.com/product-flow" },
      },
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar$/i }));

    await waitFor(() => {
      expect(getProducts()).toHaveLength(2);
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === config.getApiUrl("/api/admin/products") && init?.method === "POST",
    );

    expect(postCall).toBeDefined();
    expect(postCall?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Produto Beta",
        slug: "produto-beta",
        available: true,
        turns: [...SHIFT_CODES],
        priority: "normal",
        description: "Produto usado para validar o create.",
        url_product_flow: "https://example.com/product-flow",
      }),
    });

    await screen.findByText("Produto Beta");
  });

  it("updates a product with id in the payload", async () => {
    const { fetchMock, getProducts } = createProductsFetchMock([initialProduct]);
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsProductsPage />);
    await screen.findByText("Produto Alfa");

    const row = screen.getByText("Produto Alfa").closest("tr");
    expect(row).not.toBeNull();

    fireEvent.click(within(row as HTMLTableRowElement).getByTitle("Editar produto"));

    const dialog = await screen.findByRole("dialog", { name: /editar produto/i });
    const nameInput = within(dialog).getByLabelText("Nome");
    fireEvent.change(nameInput, { target: { value: "Produto Alfa Atualizado" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => {
      expect(getProducts()[0]?.name).toBe("Produto Alfa Atualizado");
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === config.getApiUrl("/api/admin/products") && init?.method === "PUT",
    );

    expect(putCall).toBeDefined();
    expect(putCall?.[1]).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });

    const putBody = parseJsonBody(putCall?.[1]?.body);
    expect(putBody).toMatchObject({
      id: "product-1",
      name: "Produto Alfa Atualizado",
      slug: "produto-alfa",
      available: true,
      turns: [...SHIFT_CODES],
      priority: "normal",
      description: null,
      url_product_flow: null,
    });

    await screen.findByText("Produto Alfa Atualizado");
  });

  it("toggles availability and sends the product id to delete requests", async () => {
    const { fetchMock, getProducts } = createProductsFetchMock([initialProduct]);
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsProductsPage />);
    await screen.findByText("Produto Alfa");

    fireEvent.click(screen.getByRole("button", { name: /dispon[ií]vel/i }));

    await waitFor(() => {
      expect(getProducts()[0]?.available).toBe(false);
    });

    await screen.findByRole("button", { name: /indispon[ií]vel/i });

    const toggleCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === config.getApiUrl("/api/admin/products") && init?.method === "PUT",
    );

    expect(toggleCall).toBeDefined();
    const toggleBody = parseJsonBody(toggleCall?.[1]?.body);
    expect(toggleBody).toMatchObject({
      id: "product-1",
      available: false,
    });

    fireEvent.click(screen.getByRole("button", { name: /indispon[ií]vel/i }));

    await waitFor(() => {
      expect(getProducts()[0]?.available).toBe(true);
    });

    await screen.findByRole("button", { name: /dispon[ií]vel/i });

    const deleteButton = screen.getByTitle("Excluir produto");
    fireEvent.click(deleteButton);

    const confirmationDialog = await screen.findByRole("dialog", {
      name: /confirmar exclus[aã]o/i,
    });
    fireEvent.click(
      within(confirmationDialog).getByRole("button", { name: /excluir produto/i }),
    );

    await waitFor(() => {
      expect(getProducts()).toHaveLength(0);
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url === config.getApiUrl("/api/admin/products?id=product-1") &&
        init?.method === "DELETE",
    );

    expect(deleteCall).toBeDefined();
    expect(deleteCall?.[1]).toMatchObject({ method: "DELETE" });
  });
});