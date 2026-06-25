"use client";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/admin/nav/button";
import Select from "@/components/ui/select";
import { getStatusLabel } from "@silo/engine/domain/product-status";
import {
  selectDataFlowSnapshotFromPipelines,
  useDataFlowPipelines,
} from "@/lib/dataflow/mock-ecflow";

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
  const { pipelines: dataFlowSnapshots, loading: isDataFlowLoading } = useDataFlowPipelines(
    isDataFlowPage ? modelSlug : undefined,
  );

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
    if (isDataFlowLoading && dataFlowSnapshots.length === 0) {
      return [];
    }

    const days = (() => {
      const datesFromKafka = Array.from(
        new Set(dataFlowSnapshots.map((snapshot) => snapshot.date).filter(Boolean)),
      ).sort((a, b) => b.localeCompare(a));

      if (datesFromKafka.length > 0) {
        return datesFromKafka.slice(0, 4);
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
  }, [dataFlowSnapshots, isDataFlowLoading, turns]);

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

  const selectedSnapshot = useMemo(
    () => (isDataFlowPage ? selectDataFlowSnapshotFromPipelines(dataFlowSnapshots, selectedDate, selectedTurn) : null),
    [dataFlowSnapshots, isDataFlowPage, selectedDate, selectedTurn],
  );

  const selectedStatus = selectedSnapshot ? getStatusLabel(selectedSnapshot.status) : null;

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
          {selectedStatus ? (
            <span className="rounded-md bg-blue-100 px-2 py-1 text-sm font-semibold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {selectedStatus}
            </span>
          ) : null}

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
              buttonClassName="h-10 py-0 pl-3 pr-10"
              noTruncate
            />
          </div>
        </div>
      )}
    </div>
  );
}
