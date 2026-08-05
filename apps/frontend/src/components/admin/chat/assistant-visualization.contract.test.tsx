import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";

import type { AiAssistantVisualizationDto } from "@silo/engine/contracts/dto/ai-assistant";

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  run: vi.fn(async ({ nodes }: { nodes: HTMLElement[] }) => {
    for (const node of nodes) {
      node.innerHTML = '<svg data-testid="mock-mermaid-svg"><text>renderizado</text></svg>';
    }
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    function MockECharts({ option, style }: { option: unknown; style?: CSSProperties }) {
      return (
        <div
          data-testid="assistant-echarts"
          data-option={JSON.stringify(option)}
          role="img"
          aria-label="Visualização do assistente"
          style={style}
        />
      );
    }

    return MockECharts;
  },
}));

vi.mock("@/hooks/use-dark-mode", () => ({
  useDarkMode: () => false,
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidMocks.initialize,
    run: mermaidMocks.run,
  },
}));

import AssistantVisualizationBlock from "./assistant-visualization";

type GoldenCase = {
  id: string;
  coverage: string[];
  dto: AiAssistantVisualizationDto;
  expectedRender: Record<string, unknown>;
};

type Golden = {
  visualizations: GoldenCase[];
};

const goldenPath = resolve(
  process.cwd(),
  "../../tests/fixtures/legacy-golden/phase1_28.ai_visualization_render_contract.json",
);
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Golden;

const getCase = (id: string): GoldenCase => {
  const entry = golden.visualizations.find((item) => item.id === id);
  if (!entry) {
    throw new Error(`Missing visualization golden case: ${id}`);
  }
  return entry;
};

const parseChartOption = () => {
  const raw = screen.getByTestId("assistant-echarts").getAttribute("data-option");
  if (!raw) {
    throw new Error("Missing ECharts option payload");
  }
  return JSON.parse(raw) as {
    xAxis?: { data?: string[] };
    series?: Array<{ type: string; data?: unknown[] }>;
  };
};

describe("AI assistant visualization render contract", () => {
  it.each([
    "chart-bar-hostile-negative",
    "chart-line-truncated",
    "chart-donut-zero",
    "chart-empty",
  ])("renders chart DTO %s", (caseId) => {
    const entry = getCase(caseId);
    render(<AssistantVisualizationBlock visualization={entry.dto} />);

    if (entry.dto.kind !== "chart") {
      throw new Error(`${caseId} is not a chart fixture`);
    }
    const chartDto = entry.dto;

    expect(screen.getByText(chartDto.title)).toBeInTheDocument();
    if (chartDto.subtitle) {
      expect(screen.getByText(chartDto.subtitle)).toBeInTheDocument();
    }
    expect(screen.getByTestId("assistant-echarts")).toBeInTheDocument();

    const option = parseChartOption();
    const expectedType = entry.expectedRender.echartsSeriesType;
    expect(option.series?.[0]?.type).toBe(expectedType);

    if (chartDto.chartType === "donut") {
      expect(option.series?.[0]?.data).toEqual(
        chartDto.categories.map((category, index) => ({
          name: category,
          value: chartDto.series[0]?.values[index] ?? 0,
          itemStyle: {
            color: chartDto.series[0]?.color,
          },
        })),
      );
    } else {
      expect(option.xAxis?.data).toEqual(chartDto.categories);
      expect(option.series?.[0]?.data).toEqual(chartDto.series[0]?.values);
    }

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("renders the SVG summary card image with alt and caption", () => {
    const entry = getCase("image-svg-summary-card");
    render(<AssistantVisualizationBlock visualization={entry.dto} />);

    if (entry.dto.kind !== "image") {
      throw new Error("Fixture is not image");
    }

    expect(screen.getByText(entry.dto.alt)).toBeInTheDocument();
    expect(screen.getByText(entry.dto.caption ?? "")).toBeInTheDocument();
    const image = screen.getByRole("img", { name: entry.dto.alt });
    expect(image).toHaveAttribute("src", entry.dto.src);
    expect(screen.queryByText("Conteúdo indisponível.")).not.toBeInTheDocument();
  });

  it("renders legacy PDF visualizations with the browser-safe path", () => {
    const dto: AiAssistantVisualizationDto = {
      kind: "image",
      src: "/uploads/serve/reports/executive.pdf",
      alt: "Relatório executivo",
      caption: "PDF legado",
    };

    render(<AssistantVisualizationBlock visualization={dto} />);

    expect(screen.getByText(dto.alt)).toBeInTheDocument();
    expect(screen.getByText(dto.caption ?? "")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      "/silo/api/upload/serve/reports/executive.pdf",
    );

    fireEvent.click(screen.getByRole("button", { name: "Visualizar" }));
    expect(screen.getByTitle("Visualização do PDF")).toHaveAttribute(
      "src",
      "/silo/api/upload/serve/reports/executive.pdf",
    );
  });

  it("blocks unsafe image sources while keeping accessible text", () => {
    const entry = getCase("image-unsafe-protocol-relative");
    render(<AssistantVisualizationBlock visualization={entry.dto} />);

    if (entry.dto.kind !== "image") {
      throw new Error("Fixture is not image");
    }

    expect(screen.getByText(entry.dto.alt)).toBeInTheDocument();
    expect(screen.getByText(entry.dto.caption ?? "")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo indisponível.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: entry.dto.alt })).not.toBeInTheDocument();
  });

  it("renders safe Mermaid through strict renderer", async () => {
    const entry = getCase("mermaid-safe-flow");
    render(<AssistantVisualizationBlock visualization={entry.dto} />);

    if (entry.dto.kind !== "mermaid") {
      throw new Error("Fixture is not mermaid");
    }

    expect(screen.getByText(entry.dto.title)).toBeInTheDocument();
    expect(screen.getByText(entry.dto.caption ?? "")).toBeInTheDocument();

    await waitFor(() => expect(mermaidMocks.run).toHaveBeenCalled());
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict" }),
    );
    expect(document.querySelector("[data-testid='mock-mermaid-svg']")).toBeInTheDocument();
  });

  it("blocks hostile Mermaid and renders escaped fallback", async () => {
    const entry = getCase("mermaid-hostile-blocked");
    render(<AssistantVisualizationBlock visualization={entry.dto} />);

    if (entry.dto.kind !== "mermaid") {
      throw new Error("Fixture is not mermaid");
    }

    expect(screen.getByText(entry.dto.title)).toBeInTheDocument();
    expect(screen.getByText(entry.dto.caption ?? "")).toBeInTheDocument();

    await screen.findByText("Não foi possível renderizar o diagrama");
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});
