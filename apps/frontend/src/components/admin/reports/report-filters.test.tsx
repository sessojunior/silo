import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReportFilters } from "./report-filters";

vi.mock("@/components/ui/select", () => ({
  default: ({ name, selected, options, onChange }: {
    name: string;
    selected?: string | null;
    options: Array<{ label: string; value: string }>;
    onChange?: (value: string) => void;
  }) => (
    <select
      aria-label={name}
      name={name}
      value={selected ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

describe("ReportFilters", () => {
  it("exposes the product selector for availability reports", () => {
    const onFiltersChange = vi.fn();

    render(
      <ReportFilters
        filters={{ dateRange: "30d" }}
        onFiltersChange={onFiltersChange}
        reportType="availability"
        products={[
          { id: "bam", name: "BAM" },
          { id: "wrf", name: "WRF" },
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "productId" }), {
      target: { value: "wrf" },
    });

    expect(onFiltersChange).toHaveBeenCalledWith({ dateRange: "30d", productId: "wrf" });
  });
});
