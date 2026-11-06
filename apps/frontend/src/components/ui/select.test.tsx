import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Select from "./select";

describe("Select", () => {
  it("keeps a short menu below the select when the available space is enough", () => {
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.querySelector('input[name="search"]')) {
        return {
          left: 100,
          top: 0,
          right: 400,
          bottom: 128,
          width: 300,
          height: 128,
          x: 100,
          y: 0,
          toJSON: () => ({}),
        };
      }

      return {
        left: 100,
        top: 600,
        right: 400,
        bottom: 640,
        width: 300,
        height: 40,
        x: 100,
        y: 600,
        toJSON: () => ({}),
      };
    });

    render(
      <Select
        id="ai-model"
        name="modelId"
        options={[{ value: "qwen", label: "Qwen" }]}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    const dropdown = screen.getByRole("listbox").parentElement?.parentElement;
    expect(dropdown).toHaveStyle({
      position: "fixed",
      top: "640px",
      bottom: "auto",
    });
  });

  it("anchors an upward dropdown to the select bottom edge", () => {
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.querySelector('input[name="search"]')) {
        return {
          left: 100,
          top: 0,
          right: 400,
          bottom: 240,
          width: 300,
          height: 240,
          x: 100,
          y: 0,
          toJSON: () => ({}),
        };
      }

      return {
        left: 100,
        top: 600,
        right: 400,
        bottom: 640,
        width: 300,
        height: 40,
        x: 100,
        y: 600,
        toJSON: () => ({}),
      };
    });

    render(
      <Select
        id="ai-model"
        name="modelId"
        selected="qwen"
        options={[{ value: "qwen", label: "Qwen" }]}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    const dropdown = screen.getByRole("listbox").parentElement?.parentElement;
    expect(dropdown).toHaveStyle({
      position: "fixed",
      bottom: "200px",
      top: "auto",
    });
  });
});
