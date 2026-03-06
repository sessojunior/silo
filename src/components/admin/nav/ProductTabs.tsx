"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/admin/nav/Button";
import Select from "@/components/ui/Select";
import { getStatusLabel, ProductStatus } from "@/lib/productStatus";
import groupedPipelineDataJson from "@/app/admin/products/[slug]/data-flow/pipeline-data.json";

interface ProductTabsProps {
  tabs: { label: string; url: string }[];
  modelSlug?: string;
  modelTurns?: string[];
}

interface GroupedPipelineData {
  model: string;
  date: string;
  turn: string;
  status: ProductStatus;
}

interface GroupedPipelineDataFile {
  pipelines: GroupedPipelineData[];
}

const GROUPED_PIPELINE_DATA = groupedPipelineDataJson as GroupedPipelineDataFile;
const DATA_FLOW_MODEL = "bsm";

function formatIsoDateForLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function getLastFourDaysIso(): string[] {
  const days: string[] = [];
  const now = new Date();

  for (let i = 0; i < 4; i += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }

  return days;
}

export default function ProductTabs({
  tabs,
  modelSlug,
  modelTurns,
}: ProductTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDataFlowPage = pathname.endsWith("/data-flow");

  const bsmSnapshots = useMemo(
    () =>
      GROUPED_PIPELINE_DATA.pipelines.filter(
        (snapshot) => snapshot.model === DATA_FLOW_MODEL,
      ),
    [],
  );

  const turns = useMemo(() => {
    const turnsFromBsm = Array.from(
      new Set(bsmSnapshots.map((snapshot) => String(snapshot.turn).trim()).filter(Boolean)),
    );
    const uniqueTurns = turnsFromBsm.length
      ? turnsFromBsm
      : Array.from(
          new Set((modelTurns ?? []).map((turn) => String(turn).trim()).filter(Boolean)),
        );

    if (uniqueTurns.length === 0) return ["0"];

    return uniqueTurns.sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);

      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return bNum - aNum;
      }

      return b.localeCompare(a);
    });
  }, [bsmSnapshots, modelTurns]);

  const dayTurnOptions = useMemo(() => {
    const days = (() => {
      const datesFromBsm = Array.from(
        new Set(bsmSnapshots.map((snapshot) => snapshot.date).filter(Boolean)),
      ).sort((a, b) => b.localeCompare(a));

      if (datesFromBsm.length > 0) {
        return datesFromBsm.slice(0, 4);
      }

      return getLastFourDaysIso();
    })();

    const options: { label: string; value: string }[] = [];

    for (const day of days) {
      for (const turn of turns) {
        options.push({
          value: `${day}|${turn}`,
          label: `${formatIsoDateForLabel(day)} - Turno ${turn}`,
        });
      }
    }

    return options;
  }, [bsmSnapshots, turns]);

  const selectedDate = searchParams.get("date");
  const selectedTurn = searchParams.get("turn");
  const selectedValue =
    selectedDate && selectedTurn ? `${selectedDate}|${selectedTurn}` : dayTurnOptions[0]?.value;
  const hasValidSelection = dayTurnOptions.some((option) => option.value === selectedValue);

  useEffect(() => {
    if (!isDataFlowPage || dayTurnOptions.length === 0) return;

    const defaultValue = dayTurnOptions[0].value;
    const valueToUse = hasValidSelection ? selectedValue : defaultValue;

    if (!valueToUse) return;

    const [date, turn] = valueToUse.split("|");
    if (!date || !turn) return;

    if (date === selectedDate && turn === selectedTurn) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", date);
    nextParams.set("turn", turn);

    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [
    dayTurnOptions,
    hasValidSelection,
    isDataFlowPage,
    pathname,
    router,
    searchParams,
    selectedDate,
    selectedTurn,
    selectedValue,
  ]);

  const selectValue = hasValidSelection
    ? selectedValue
    : dayTurnOptions[0]?.value;

  const selectedStatusLabel = useMemo(() => {
    if (!isDataFlowPage || !selectValue) return null;

    const [date, turn] = selectValue.split("|");
    if (!date || !turn) return null;

    const snapshots = GROUPED_PIPELINE_DATA.pipelines;
    const byModelAndSlot = snapshots.find(
      (snapshot) =>
        snapshot.model === modelSlug &&
        snapshot.date === date &&
        snapshot.turn === turn,
    );

    const bySlot = snapshots.find(
      (snapshot) => snapshot.date === date && snapshot.turn === turn,
    );

    const target = byModelAndSlot ?? bySlot;
    if (!target) return null;

    return `${getStatusLabel(target.status)}`;
  }, [isDataFlowPage, modelSlug, selectValue]);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex gap-x-2">
        {/* Botões */}
        {tabs.map((tab) => (
          <Button key={tab.url} href={tab.url} active={pathname === tab.url}>
            {tab.label}
          </Button>
        ))}
      </div>

      {isDataFlowPage && (
        <div className="flex items-center gap-4">
          {selectedStatusLabel && (
            <div className="text-base text-right text-zinc-700 dark:text-zinc-200 min-w-32">
              {selectedStatusLabel}
            </div>
          )}

          <div className="w-full max-w-sm min-w-60">
            <Select
              name="data-flow-day-turn"
              placeholder="Selecione dia e turno"
              selected={selectValue}
              options={dayTurnOptions}
              onChange={(value) => {
                const [date, turn] = value.split("|");
                if (!date || !turn) return;

                const nextParams = new URLSearchParams(searchParams.toString());
                nextParams.set("date", date);
                nextParams.set("turn", turn);
                nextParams.set("model", DATA_FLOW_MODEL);

                router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
