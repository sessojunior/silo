import { afterEach, describe, expect, it, vi } from "vitest";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AdminLayout from "./layout";
import { getAuthUser } from "@/lib/auth/server";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    getApiUrl: (path: string) => path,
    getPublicPath: (path: string) => path,
    publicBasePath: "",
  },
}));

const mockedCookies = vi.mocked(cookies);
const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedRedirect = vi.mocked(redirect);

describe("AdminLayout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    mockedCookies.mockResolvedValue({
      get: vi.fn(() => undefined),
      getAll: vi.fn(() => []),
    } as never);
    mockedGetAuthUser.mockResolvedValue(null);

    await expect(
      AdminLayout({
        children: <div data-testid="child" />,
      }),
    ).rejects.toThrow("redirect:/login");
    expect(mockedRedirect).toHaveBeenCalledWith("/login");
  });

  it("fetches the authenticated profile on the server before rendering children", async () => {
    mockedCookies.mockResolvedValue({
      get: vi.fn(() => undefined),
      getAll: vi.fn(() => [
        { name: "session", value: "session-value" },
        { name: "theme", value: "dark" },
      ]),
    } as never);
    mockedGetAuthUser.mockResolvedValue({
      id: "user-1",
      name: "User One",
      email: "user.one@example.test",
      image: "/uploads/avatars/user-one.webp",
    } as never);

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              id: "user-1",
              name: "User One",
              email: "user.one@example.test",
              isActive: true,
              emailVerified: true,
              image: "/uploads/avatars/user-one.webp",
            },
            userProfile: {
              genre: "female",
              role: "Analyst",
              phone: "5511999999999",
              company: "INPE",
              location: "Sao Jose",
              team: "Produto",
            },
            groups: [],
            permissions: {},
            isAdmin: true,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const tree = await AdminLayout({
      children: <main data-testid="child">Conteudo</main>,
    });

    expect(tree).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/users/profile", {
      headers: {
        cookie: "session=session-value; theme=dark",
      },
      cache: "no-store",
    });
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
