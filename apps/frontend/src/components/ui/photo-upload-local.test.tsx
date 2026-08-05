import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@silo/engine/format/toast";

import { useUser } from "@/context/user-context";
import { config } from "@/lib/config";

import PhotoUploadLocal from "./photo-upload-local";

vi.mock("next/image", () => ({
  default: function MockImage({
    src,
    alt,
    onError,
    ...rest
  }: {
    src?: string;
    alt?: string;
    onError?: () => void;
    [key: string]: unknown;
  }) {
    const imageProps = rest as Record<string, unknown>;
    return <img src={src} alt={alt} onError={onError} {...imageProps} />;
  },
}));

vi.mock("@/context/user-context", () => ({
  useUser: vi.fn(),
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

vi.mock("@silo/engine/format/ui", () => ({
  normalizeUploadsSrc: (value: string) => value,
}));

const mockedUseUser = vi.mocked(useUser);

describe("PhotoUploadLocal", () => {
  const updateUser = vi.fn();

  beforeEach(() => {
    mockedUseUser.mockReturnValue({
      updateUser,
    } as never);
    updateUser.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("rejects invalid file types before calling the upload API", () => {
    const { container } = render(<PhotoUploadLocal image="/uploads/avatars/user.webp" />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["dummy"], "document.txt", { type: "text/plain" })],
      },
    });

    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "Tipo de arquivo não permitido",
      }),
    );
    expect(screen.getByText(/tipo de arquivo não permitido/i)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("uploads a valid image and updates the current user image", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect((init?.body as FormData).get("fileToUpload")).toBe(file);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            imageUrl: "/uploads/avatars/new-avatar.webp",
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

    const { container } = render(<PhotoUploadLocal image="/uploads/avatars/user.webp" />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/profile-image", {
      method: "POST",
      body: expect.any(FormData),
    });
    expect(updateUser).toHaveBeenCalledWith({
      image: "/uploads/avatars/new-avatar.webp",
    });
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Imagem atualizada",
      }),
    );
  });

  it("deletes the current image and resets the profile picture", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("DELETE");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PhotoUploadLocal image="/uploads/avatars/user.webp" />);
    fireEvent.click(screen.getByRole("button", { name: /apagar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(updateUser).toHaveBeenCalledWith({
      image: "/images/profile.png",
    });
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Imagem removida",
      }),
    );
  });
});
