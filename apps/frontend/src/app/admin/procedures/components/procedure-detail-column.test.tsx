import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import { ProcedureDetailColumn } from "./procedure-detail-column";

describe("ProcedureDetailColumn", () => {
  it("aponta anexos para a rota pública com o base path da aplicação", () => {
    const procedure: GeneralProcedureDto = {
      id: "procedure-1",
      title: "Reiniciar serviço",
      category: "Infraestrutura",
      content: "Conteúdo do procedimento",
      active: true,
      userId: "user-1",
      createdAt: "2026-10-23T10:00:00Z",
      updatedAt: "2026-10-23T10:00:00Z",
      attachments: [
        {
          id: "attachment-1",
          procedureId: "procedure-1",
          kind: "document",
          originalName: "passos.txt",
          url: "/uploads/procedures/passos.txt",
          mimeType: "text/plain",
          sizeBytes: 12,
          sortOrder: 0,
          extractionStatus: "ready",
          extractionError: null,
          imageDescription: null,
        },
      ],
    };

    render(
      <ProcedureDetailColumn
        procedure={procedure}
        canManage={false}
        onAddProcedure={vi.fn()}
        onEditProcedure={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /passos\.txt/i })).toHaveAttribute(
      "href",
      "/silo/uploads/procedures/passos.txt",
    );
  });
});
