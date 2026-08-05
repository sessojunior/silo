import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@silo/engine/format/toast";

import { useUser } from "@/context/user-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { config } from "@/lib/config";
import { useSearchParams } from "next/navigation";

import SettingsPage from "./page";

type CurrentUserState = {
  currentUser: {
    name: string;
    email: string;
    image?: string | null;
  } | null;
  loading: boolean;
  error: string | null;
};

type UserProfile = {
  genre: string;
  role: string;
  phone: string;
  company: string;
  location: string;
  team: string;
};

type UserPreferences = {
  chatEnabled: boolean;
  showWelcome: boolean;
};

type UserContextState = {
  userProfile: UserProfile | null;
  userPreferences: UserPreferences | null;
  updateUser: ReturnType<typeof vi.fn>;
  updateUserProfile: ReturnType<typeof vi.fn>;
  updateUserPreferences: ReturnType<typeof vi.fn>;
};

let searchParamsState = new URLSearchParams("tab=profile");
let currentUserState: CurrentUserState = {
  currentUser: null,
  loading: false,
  error: null,
};
let userContextState: UserContextState = {
  userProfile: null,
  userPreferences: null,
  updateUser: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPreferences: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsState,
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => currentUserState,
}));

vi.mock("@/context/user-context", () => ({
  useUser: () => userContextState,
}));

vi.mock("@/lib/config", () => ({
  config: {
    getApiUrl: (path: string) => path,
    getPublicPath: (path: string) => path,
    publicBasePath: "",
  },
}));

vi.mock("@silo/engine/format/toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/ui/label", () => ({
  default: function MockLabel({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) {
    return <label htmlFor={htmlFor}>{children}</label>;
  },
}));

vi.mock("@/components/ui/button", () => ({
  default: function MockButton({
    children,
    type = "button",
    disabled,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    [key: string]: unknown;
  }) {
    const { style: _style, ...buttonProps } = rest as Record<string, unknown>;
    return (
      <button type={type} disabled={disabled} onClick={onClick} {...buttonProps}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/input", () => ({
  default: function MockInput({
    id,
    value,
    setValue,
    invalidMessage: _invalidMessage,
    isInvalid: _isInvalid,
    ...rest
  }: {
    id?: string;
    value?: string;
    setValue?: (value: string) => void;
    invalidMessage?: string;
    isInvalid?: boolean;
    [key: string]: unknown;
  }) {
    const inputProps = rest as Record<string, unknown>;
    return (
      <input
        id={id}
        value={value ?? ""}
        onChange={(event) => setValue?.((event.target as HTMLInputElement).value)}
        {...inputProps}
      />
    );
  },
}));

vi.mock("@/components/ui/select", () => ({
  default: function MockSelect({
    id,
    selected,
    onChange,
    options,
    ...rest
  }: {
    id?: string;
    selected?: string;
    onChange?: (value: string) => void;
    options?: { label: string; value: string }[];
    [key: string]: unknown;
  }) {
    const selectProps = rest as Record<string, unknown>;
    return (
      <select
        id={id}
        value={selected ?? ""}
        onChange={(event) => onChange?.((event.target as HTMLSelectElement).value)}
        {...selectProps}
      >
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
}));

vi.mock("@/components/ui/switch", () => ({
  default: function MockSwitch({
    id,
    checked,
    onChange,
    title,
    description,
  }: {
    id?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    title?: string;
    description?: string;
  }) {
    return (
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange?.((event.target as HTMLInputElement).checked)}
        />
        <span>{title}</span>
        {description ? <span>{description}</span> : null}
      </label>
    );
  },
}));

vi.mock("@/components/ui/pin", () => ({
  default: function MockPin({
    id,
    value,
    setValue,
    compact: _compact,
    ...rest
  }: {
    id?: string;
    value?: string;
    setValue?: (value: string) => void;
    compact?: boolean;
    [key: string]: unknown;
  }) {
    const pinProps = rest as Record<string, unknown>;
    return (
      <input
        id={id}
        value={value ?? ""}
        onChange={(event) => setValue?.((event.target as HTMLInputElement).value)}
        {...pinProps}
      />
    );
  },
}));

vi.mock("@/components/ui/input-password-hints", () => ({
  default: function MockInputPasswordHints({
    id,
    value,
    setValue,
    ...rest
  }: {
    id?: string;
    value?: string;
    setValue?: (value: string) => void;
    [key: string]: unknown;
  }) {
    const passwordProps = rest as Record<string, unknown>;
    return (
      <input
        id={id}
        value={value ?? ""}
        onChange={(event) => setValue?.((event.target as HTMLInputElement).value)}
        {...passwordProps}
      />
    );
  },
}));

vi.mock("@/components/ui/photo-upload-local", () => ({
  default: function MockPhotoUploadLocal() {
    return <div data-testid="photo-upload-local" />;
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

describe("SettingsPage", () => {
  beforeEach(() => {
    searchParamsState = new URLSearchParams("tab=profile");
    currentUserState = {
      currentUser: {
        name: "User One",
        email: "user.one@example.test",
        image: "/uploads/avatars/user-one.webp",
      },
      loading: false,
      error: null,
    };
    userContextState = {
      userProfile: null,
      userPreferences: null,
      updateUser: vi.fn(),
      updateUserProfile: vi.fn(),
      updateUserPreferences: vi.fn(),
    };
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads profile data and saves profile edits through the admin API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "GET" && requestUrl.pathname === "/api/admin/users/profile") {
        return jsonResponse({
          success: true,
          user: {
            name: "User One",
            email: "user.one@example.test",
            image: "/uploads/avatars/user-one.webp",
          },
          userProfile: {
            genre: "female",
            role: "analyst",
            phone: "5511999999999",
            company: "INPE",
            location: "sao-jose-dos-campos",
            team: "inpe",
          },
        });
      }

      if (method === "GET" && requestUrl.pathname === "/api/admin/users/preferences") {
        return jsonResponse({
          success: true,
          userPreferences: {
            chatEnabled: false,
            showWelcome: true,
          },
        });
      }

      if (method === "PUT" && requestUrl.pathname === "/api/admin/users/profile") {
        expect(parseJsonBody(init?.body)).toMatchObject({
          name: "User One Atualizado",
          genre: "female",
          role: "analyst",
          phone: "5511999999999",
          company: "INPE",
          location: "sao-jose-dos-campos",
          team: "inpe",
        });
        return jsonResponse({ success: true, message: "Perfil atualizado" });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    await screen.findByTestId("photo-upload-local");
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "User One Atualizado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(userContextState.updateUser).toHaveBeenCalledWith({
      name: "User One Atualizado",
    });
    expect(userContextState.updateUserProfile).toHaveBeenCalledWith({
      genre: "female",
      role: "analyst",
      phone: "5511999999999",
      company: "INPE",
      location: "sao-jose-dos-campos",
      team: "inpe",
    });
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Dados do perfil alterados com sucesso.",
      }),
    );
  });

  it("saves preferences and dispatches the chat preference event", async () => {
    searchParamsState = new URLSearchParams("tab=preferences");
    userContextState = {
      userProfile: {
        genre: "female",
        role: "analyst",
        phone: "5511999999999",
        company: "INPE",
        location: "sao-jose-dos-campos",
        team: "inpe",
      },
      userPreferences: {
        chatEnabled: false,
        showWelcome: true,
      },
      updateUser: vi.fn(),
      updateUserProfile: vi.fn(),
      updateUserPreferences: vi.fn(),
    };

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "PUT" && requestUrl.pathname === "/api/admin/users/preferences") {
        expect(parseJsonBody(init?.body)).toEqual({ chatEnabled: true });
        return jsonResponse({ success: true, message: "Preferências atualizadas" });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: /ativar sistema de chat/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar prefer/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(userContextState.updateUserPreferences).toHaveBeenCalledWith({
      chatEnabled: true,
    });
    expect(localStorage.getItem("hideWelcome")).toBe("false");
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chatPreferenceChanged",
      }),
    );
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Preferências alteradas com sucesso.",
      }),
    );
  });

  it("confirms email changes and updates the password on the security tab", async () => {
    searchParamsState = new URLSearchParams("tab=security");
    userContextState = {
      userProfile: {
        genre: "female",
        role: "analyst",
        phone: "5511999999999",
        company: "INPE",
        location: "sao-jose-dos-campos",
        team: "inpe",
      },
      userPreferences: {
        chatEnabled: true,
        showWelcome: true,
      },
      updateUser: vi.fn(),
      updateUserProfile: vi.fn(),
      updateUserPreferences: vi.fn(),
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();

      if (method === "POST" && requestUrl.pathname === "/api/admin/users/email-change") {
        expect(parseJsonBody(init?.body)).toEqual({
          email: "user.one.updated@example.test",
        });
        return jsonResponse({ success: true, message: "Código enviado" });
      }

      if (method === "PUT" && requestUrl.pathname === "/api/admin/users/email-change") {
        expect(parseJsonBody(init?.body)).toEqual({
          newEmail: "user.one.updated@example.test",
          code: "123456",
        });
        return jsonResponse({ success: true, message: "Email atualizado" });
      }

      if (method === "PUT" && requestUrl.pathname === "/api/user-password") {
        expect(parseJsonBody(init?.body)).toEqual({
          password: "StrongPass123!",
        });
        return jsonResponse({ success: true, message: "Senha atualizada" });
      }

      throw new Error(`Unexpected request: ${method} ${requestUrl.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("Novo e-mail"), {
      target: { value: "user.one.updated@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /alterar e-mail/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/código de verificação enviado/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Código de Verificação"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar altera/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /alterar senha/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(userContextState.updateUser).toHaveBeenCalledWith({
      email: "user.one.updated@example.test",
    });
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "A senha foi alterada com sucesso.",
      }),
    );
  });
});
