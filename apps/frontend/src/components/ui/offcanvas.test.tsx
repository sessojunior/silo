import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Offcanvas from "./offcanvas";

describe("Offcanvas", () => {
  it("foca o painel, fecha pelo backdrop/Escape e restaura o foco", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Abrir painel</button>
        <Offcanvas open={false} onClose={onClose} title="Filtros">
          <button type="button">Aplicar</button>
        </Offcanvas>
      </>,
    );

    const opener = screen.getByRole("button", { name: "Abrir painel" });
    opener.focus();
    rerender(
      <>
        <button type="button">Abrir painel</button>
        <Offcanvas open onClose={onClose} title="Filtros">
          <button type="button">Aplicar</button>
        </Offcanvas>
      </>,
    );

    const panel = await screen.findByRole("dialog", { name: "Filtros" });
    const closeButton = screen.getByRole("button", { name: "Fechar painel" });
    const applyButton = screen.getByRole("button", { name: "Aplicar" });
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    applyButton.focus();
    expect(applyButton).toHaveFocus();
    cancelButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(panel.parentElement?.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <>
        <button type="button">Abrir painel</button>
        <Offcanvas open={false} onClose={onClose} title="Filtros">
          <button type="button">Aplicar</button>
        </Offcanvas>
      </>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
      expect(document.body.style.overflow).toBe("");
    });
  });
});
