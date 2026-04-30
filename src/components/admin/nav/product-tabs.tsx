"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/admin/nav/button";
import Select from "@/components/ui/select";
import { getStatusLabel } from "@/lib/product-status";
import { config } from "@/lib/config";
import type { GroupedPipelineData } from "@/lib/dataflow/types";

interface ProductTabsProps {
  tabs: { label: string; url: string }[];
  modelSlug?: string;
  modelTurns?: string[];
}

const DATA_FLOW_TAB_TITLE =
  "Fluxo de dados obtido pelo Kafka REST Proxy. Enquanto o proxy real nao estiver ativo, a tela usa snapshots simulados.";

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
  const [dataFlowSnapshots, setDataFlowSnapshots] = useState<GroupedPipelineData[]>([]);
  const [hasLoadedDataFlowOptions, setHasLoadedDataFlowOptions] = useState(false);

  useEffect(() => {
    if (!isDataFlowPage || !modelSlug) return;

    let isCancelled = false;
    setHasLoadedDataFlowOptions(false);

    const loadDataFlowOptions = async () => {
      try {
        const response = await fetch(
          config.getApiUrl(`/api/admin/products/${encodeURIComponent(modelSlug)}/data-flow`),
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (!isCancelled) setHasLoadedDataFlowOptions(true);
          return;
        }

        const payload = (await response.json()) as { data?: { pipelines?: GroupedPipelineData[] } };
        if (!isCancelled) {
          setDataFlowSnapshots(Array.isArray(payload.data?.pipelines) ? payload.data.pipelines : []);
          setHasLoadedDataFlowOptions(true);
        }
      } catch {
        if (!isCancelled) {
          setDataFlowSnapshots([]);
          setHasLoadedDataFlowOptions(true);
        }
      }
    };

    loadDataFlowOptions();

    return () => {
      isCancelled = true;
    };
  }, [isDataFlowPage, modelSlug]);

  const turns = useMemo(() => {
    const turnsFromKafka = Array.from(
      new Set(dataFlowSnapshots.map((snapshot) => String(snapshot.turn).trim()).filter(Boolean)),
    );
    const uniqueTurns = turnsFromKafka.length
      ? turnsFromKafka
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
  }, [dataFlowSnapshots, modelTurns]);

  const dayTurnOptions = useMemo(() => {
    const days = (() => {
      const datesFromKafka = Array.from(
        new Set(dataFlowSnapshots.map((snapshot) => snapshot.date).filter(Boolean)),
      ).sort((a, b) => b.localeCompare(a));

      if (datesFromKafka.length > 0) {
        return datesFromKafka.slice(0, 4);
      }

      if (isDataFlowPage && !hasLoadedDataFlowOptions) {
        return [];
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
  }, [dataFlowSnapshots, hasLoadedDataFlowOptions, isDataFlowPage, turns]);

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

    const target = dataFlowSnapshots.find(
      (snapshot) => snapshot.date === date && snapshot.turn === turn,
    );
    if (!target) return null;

    return `${getStatusLabel(target.status)}`;
  }, [dataFlowSnapshots, isDataFlowPage, selectValue]);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex gap-x-2">
        {/* Botões */}
        {tabs.map((tab) => (
          <Button
            key={tab.url}
            href={tab.url}
            active={pathname === tab.url}
            title={tab.label === "Fluxo de dados" ? DATA_FLOW_TAB_TITLE : undefined}
          >
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

                router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
