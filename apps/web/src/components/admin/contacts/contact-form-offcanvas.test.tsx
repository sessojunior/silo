import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import ContactFormOffcanvas from "./contact-form-offcanvas";

interface OffcanvasMockProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footerActions?: ReactNode;
}

interface UploadButtonLocalMockProps {
  endpoint?: string;
  onClientUploadComplete?: (res: { url: string } | Array<{ url: string }>) => void | Promise<void>;
  onUploadError?: (error: { message: string }) => void;
}

interface NextImageMockProps {
  src: string | { src: string };
  alt: string;
  className?: string;
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

vi.mock("@/components/ui/upload-button-local", () => ({
  default: function MockUploadButtonLocal({ endpoint }: UploadButtonLocalMockProps) {
    return <div data-testid={`upload-button-${endpoint ?? "unknown"}`} />;
  },
}));

vi.mock("next/image", () => ({
  default: function MockNextImage({ src, alt, className }: NextImageMockProps) {
    const imageSrc = typeof src === "string" ? src : src.src;
    return <div data-testid="next-image" aria-label={alt} data-src={imageSrc} className={className} />;
  },
}));

interface ContactRecord {
  id: string;
  name: string;
  role: string;
  team: string;
  email: string;
  phone: string | null;
  image: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

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

function createContactsFetchMock() {
  const contactsPathname = new URL(
    config.getApiUrl("/api/admin/contacts"),
    "http://localhost",
  ).pathname;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname !== contactsPathname) {
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    }

    if (method === "POST") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        name: "Contato Beta",
        role: "Pesquisador Sênior",
        team: "Meteorologia",
        email: "contato.beta@example.com",
        phone: "(12) 3208-6000",
        active: true,
      });

      return jsonResponse({ success: true, message: "Contato criado com sucesso" }, 201);
    }

    if (method === "PUT") {
      const body = parseJsonBody(init?.body);
      expect(body).toMatchObject({
        id: "contact-1",
        name: "Contato Alfa",
        role: "Pesquisador Sênior",
        team: "Meteorologia",
        email: "contato.alfa@example.com",
        phone: "",
        active: true,
        removeImage: true,
      });

      return jsonResponse({ success: true, message: "Contato atualizado com sucesso" });
    }

    throw new Error(`Unexpected method: ${method}`);
  });

  return { fetchMock };
}

const createContact: ContactRecord = {
  id: "contact-new",
  name: "Contato Beta",
  role: "Pesquisador Sênior",
  team: "Meteorologia",
  email: "contato.beta@example.com",
  phone: "(12) 3208-6000",
  image: null,
  active: true,
  createdAt: "2025-05-20T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

const updateContact: ContactRecord = {
  id: "contact-1",
  name: "Contato Alfa",
  role: "Pesquisador Sênior",
  team: "Meteorologia",
  email: "contato.alfa@example.com",
  phone: null,
  image: "/uploads/avatars/contact-1.png",
  active: true,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("ContactFormOffcanvas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a contact through the JSON API contract", async () => {
    const { fetchMock } = createContactsFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ContactFormOffcanvas
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: Dr. João Silva"), {
      target: { value: createContact.name },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: Pesquisador Sênior"), {
      target: { value: createContact.role },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: Meteorologia Dinâmica"), {
      target: { value: createContact.team },
    });
    fireEvent.change(screen.getByPlaceholderText("joao.silva@inpe.br"), {
      target: { value: createContact.email },
    });
    fireEvent.change(screen.getByPlaceholderText("(12) 3208-6000"), {
      target: { value: createContact.phone },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar contato/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(new URL(String(requestUrl), "http://localhost").pathname).toBe(
      new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname,
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Contato Beta",
      role: "Pesquisador Sênior",
      team: "Meteorologia",
      email: "contato.beta@example.com",
      phone: "(12) 3208-6000",
      active: true,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves image removal through the JSON API contract", async () => {
    const { fetchMock } = createContactsFetchMock();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ContactFormOffcanvas
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        contact={updateContact}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remover imagem/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [requestUrl, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(new URL(String(requestUrl), "http://localhost").pathname).toBe(
      new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname,
    );
    expect(init).toMatchObject({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      id: "contact-1",
      name: "Contato Alfa",
      role: "Pesquisador Sênior",
      team: "Meteorologia",
      email: "contato.alfa@example.com",
      phone: "",
      active: true,
      removeImage: true,
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});