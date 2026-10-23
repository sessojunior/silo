import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import { ProcedureListColumn } from "./procedure-list-column";

const procedure: GeneralProcedureDto = {
  id: "procedure-1",
  title: "Reiniciar serviÃ§o",
  category: "Infraestrutura",
  content: "Reinicie o serviÃ§o.",
  active: true,
  userId: "user-1",
  createdAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
  attachments: [],
};

describe("ProcedureListColumn", () => {
  it("usa o Select compartilhado para filtrar o status", async () => {
    const setStatusFilter = vi.fn();

    render(
      <ProcedureListColumn
        search=""
        setSearch={vi.fn()}
        statusFilter="active"
        setStatusFilter={setStatusFilter}
        procedures={[procedure]}
        selectedProcedureId={null}
        loading={false}
        canManage={false}
        onAddProcedure={vi.fn()}
        onSelectProcedure={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativos" })).toBeInTheDocument();
  });
});
