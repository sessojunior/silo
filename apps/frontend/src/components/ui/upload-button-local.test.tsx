import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UploadButtonLocal from "./upload-button-local";

describe("UploadButtonLocal", () => {
  it("envia a sessão ao fazer upload de uma imagem", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { url: "/uploads/solutions/example.webp" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onClientUploadComplete = vi.fn();

    const { container } = render(
      <UploadButtonLocal
        endpoint="solutionImageUploader"
        multiple={false}
        onClientUploadComplete={onClientUploadComplete}
      />,
    );

    const file = new File(["image"], "solution.png", { type: "image/png" });
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [file] },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/silo/api/upload/solutions",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(onClientUploadComplete).toHaveBeenCalledWith({
      url: "/uploads/solutions/example.webp",
    });
  });
});
