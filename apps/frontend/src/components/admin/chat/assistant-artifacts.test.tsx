import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AiAssistantArtifactDto } from "@silo/engine/contracts/dto/ai-assistant";

import AssistantArtifactsBlock from "./assistant-artifacts";

describe("assistant artifacts block", () => {
  it("renders a safe PDF artifact with preview controls", () => {
    const artifact: AiAssistantArtifactDto = {
      kind: "pdf",
      url: "/uploads/serve/reports/executive.pdf",
      filename: "executive.pdf",
      title: "Relatório executivo",
      mimeType: "application/pdf",
      reportType: "executive",
      checksum: "abc123",
      byteSize: 1024,
    };

    render(<AssistantArtifactsBlock artifacts={[artifact]} />);

    expect(screen.getByText("Relatório executivo")).toBeInTheDocument();
    expect(screen.getByText(/Relatório executive/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      "/silo/api/upload/serve/reports/executive.pdf",
    );

    fireEvent.click(screen.getByRole("button", { name: "Visualizar" }));
    expect(screen.getByTitle("Relatório executivo")).toHaveAttribute(
      "src",
      "/silo/api/upload/serve/reports/executive.pdf",
    );
  });

  it("shows a placeholder when the PDF URL is unsafe", () => {
    const artifact: AiAssistantArtifactDto = {
      kind: "pdf",
      url: "https://evil.test/report.pdf",
      filename: "report.pdf",
      title: null,
      mimeType: "application/pdf",
      reportType: "executive",
      checksum: null,
      byteSize: null,
    };

    render(<AssistantArtifactsBlock artifacts={[artifact]} />);

    expect(screen.getByText("Conteúdo indisponível.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Baixar PDF" })).not.toBeInTheDocument();
  });
});
