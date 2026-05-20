import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "@/lib/config";
import type { ContactDto as Contact } from "@silo/engine/contracts/dto/contacts";
import ContactsPage from "./page";

interface ShellMockProps {
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

vi.mock("@/components/ui/loading-spinner", () => ({
  default: function MockLoadingSpinner() {
    return <div data-testid="loading-spinner" />;
  },
}));

vi.mock("@/components/ui/avatar", () => ({
  default: function MockAvatar() {
    return <div data-testid="avatar" aria-hidden="true" />;
  },
}));

vi.mock("@/components/ui/offcanvas", () => ({
  default: function MockOffcanvas({
    open,
    title,
    children,
    footerActions,
    onClose,
  }: ShellMockProps) {
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

vi.mock("@/components/ui/upload-button-local", () => ({
  default: function MockUploadButtonLocal() {
    return <div data-testid="upload-button-local" />;
  },
}));

vi.mock("next/image", () => ({
  default: function MockNextImage({ alt }: { alt: string }) {
    return <img alt={alt} />;
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

function createContactsFetchMock(initialContacts: Contact[]) {
  const contactsPathname = new URL(
    config.getApiUrl("/api/admin/contacts"),
    "http://localhost",
  ).pathname;

  let contacts = initialContacts.map((contact) => ({ ...contact }));
  let nextContactSequence = contacts.length + 1;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();

    if (requestUrl.pathname !== contactsPathname) {
      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    }

    if (method === "GET") {
      return jsonResponse({
        success: true,
        data: { items: contacts },
      });
    }

    if (method === "POST") {
      const body = parseJsonBody(init?.body);

      expect(body).toMatchObject({
        name: "Contato Beta",
        role: "Pesquisador Sênior",
        team: "Meteorologia",
        email: "contato.beta@example.com",
        phone: "",
        active: true,
      });

      const newContact: Contact = {
        id: `contact-${nextContactSequence}`,
        name: "Contato Beta",
        role: "Pesquisador Sênior",
        team: "Meteorologia",
        email: "contato.beta@example.com",
        phone: "",
        image: null,
        active: true,
        createdAt: "2025-05-20T00:00:00.000Z",
        updatedAt: "2025-05-20T00:00:00.000Z",
      };

      contacts = [...contacts, newContact];
      nextContactSequence += 1;

      return jsonResponse({ success: true, message: "Contato criado com sucesso" }, 201);
    }

    if (method === "PUT") {
      const body = parseJsonBody(init?.body);
      const contactId = String(body.id);

      expect(body).toMatchObject({
        id: contactId,
        name: "Contato Alfa Revisado",
        email: "alfa.revisado@example.com",
      });

      contacts = contacts.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              name: "Contato Alfa Revisado",
              email: "alfa.revisado@example.com",
              updatedAt: "2025-05-21T00:00:00.000Z",
            }
          : contact,
      );

      return jsonResponse({ success: true, message: "Contato atualizado com sucesso" });
    }

    if (method === "DELETE") {
      const body = parseJsonBody(init?.body);
      const contactId = String(body.id);

      expect(body).toEqual({ id: contactId });

      contacts = contacts.filter((contact) => contact.id !== contactId);

      return jsonResponse({ success: true, message: "Contato excluído com sucesso" });
    }

    throw new Error(`Unexpected method: ${method}`);
  });

  return {
    fetchMock,
    getContacts: () => contacts,
  };
}

const initialContact: Contact = {
  id: "contact-1",
  name: "Contato Alfa",
  role: "Pesquisador",
  team: "Meteorologia",
  email: "contato.alfa@example.com",
  phone: "(12) 3208-6000",
  image: null,
  active: true,
  createdAt: "2025-05-19T00:00:00.000Z",
  updatedAt: "2025-05-20T00:00:00.000Z",
};

describe("ContactsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads, creates, updates and deletes contacts through the page flow", async () => {
    const { fetchMock, getContacts } = createContactsFetchMock([initialContact]);
    vi.stubGlobal("fetch", fetchMock);

    render(<ContactsPage />);

    await screen.findByText("Contato Alfa");

    fireEvent.click(screen.getByRole("button", { name: /novo contato/i }));

    const createDialog = await screen.findByRole("dialog", { name: "Novo Contato" });
    fireEvent.change(within(createDialog).getByPlaceholderText("Ex: Dr. João Silva"), {
      target: { value: "Contato Beta" },
    });
    fireEvent.change(within(createDialog).getByPlaceholderText("Ex: Pesquisador Sênior"), {
      target: { value: "Pesquisador Sênior" },
    });
    fireEvent.change(within(createDialog).getByPlaceholderText("Ex: Meteorologia Dinâmica"), {
      target: { value: "Meteorologia" },
    });
    fireEvent.change(within(createDialog).getByPlaceholderText("joao.silva@inpe.br"), {
      target: { value: "contato.beta@example.com" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: /criar contato/i }));

    await waitFor(() => {
      expect(screen.getByText("Contato Beta")).toBeInTheDocument();
    });

    expect(getContacts()).toHaveLength(2);

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname &&
        init?.method === "POST",
    );
    expect(createCall).toBeDefined();

    const contactRow = screen.getByText("Contato Alfa").closest("tr");
    expect(contactRow).not.toBeNull();

    fireEvent.click(within(contactRow as HTMLTableRowElement).getByTitle("Editar contato"));

    const editDialog = await screen.findByRole("dialog", { name: "Editar Contato" });
    fireEvent.change(within(editDialog).getByPlaceholderText("Ex: Dr. João Silva"), {
      target: { value: "Contato Alfa Revisado" },
    });
    fireEvent.change(within(editDialog).getByPlaceholderText("joao.silva@inpe.br"), {
      target: { value: "ALFA.REVISADO@EXAMPLE.COM" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: /atualizar contato/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            new URL(String(url), "http://localhost").pathname ===
              new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname &&
            init?.method === "PUT",
        ),
      ).toBe(true);
    });

    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname &&
        init?.method === "PUT",
    );

    expect(updateCall).toBeDefined();
    const updateBody = parseJsonBody(updateCall?.[1]?.body);
    expect(updateBody).toMatchObject({
      id: "contact-1",
      name: "Contato Alfa Revisado",
      email: "alfa.revisado@example.com",
    });
    expect(getContacts()[0]?.name).toBe("Contato Alfa Revisado");

    const deleteButton = screen.getAllByTitle("Excluir contato")[0];
    expect(deleteButton).toBeDefined();

    fireEvent.click(deleteButton);

    const deleteDialog = await screen.findByRole("dialog", { name: "Confirmar exclusão" });
    fireEvent.click(
      within(deleteDialog).getByRole("button", { name: /excluir contato/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Contato Alfa Revisado")).not.toBeInTheDocument();
    });

    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          new URL(config.getApiUrl("/api/admin/contacts"), "http://localhost").pathname &&
        init?.method === "DELETE",
    );

    expect(deleteCall).toBeDefined();
    expect(parseJsonBody(deleteCall?.[1]?.body)).toEqual({ id: "contact-1" });
    expect(getContacts()).toHaveLength(1);
  });
});