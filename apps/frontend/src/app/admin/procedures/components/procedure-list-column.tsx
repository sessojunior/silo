"use client";

import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import Button from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import Select from "@/components/ui/select";

type StatusFilter = "all" | "active" | "inactive";

interface ProcedureListColumnProps {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  procedures: GeneralProcedureDto[];
  selectedProcedureId: string | null;
  loading: boolean;
  canManage: boolean;
  onAddProcedure: () => void;
  onSelectProcedure: (procedure: GeneralProcedureDto) => void;
}

export function ProcedureListColumn({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  procedures,
  selectedProcedureId,
  loading,
  canManage,
  onAddProcedure,
  onSelectProcedure,
}: ProcedureListColumnProps) {
  return (
    <div className="flex w-full shrink-0 flex-col border-r border-zinc-200 sm:w-md dark:border-zinc-700">
      <div className="scrollbar size-full h-[calc(100vh-140px)] overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-4 dark:border-zinc-700">
          <div className="relative flex h-10 flex-1">
            <input
              type="text"
              name="procedure"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="block w-full rounded-lg border-zinc-200 px-4 py-2.5 pe-11 sm:py-3 sm:text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:placeholder-zinc-500"
              placeholder="Procurar procedimento..."
              aria-label="Procurar procedimento"
            />
            <div className="pointer-events-none absolute inset-y-0 end-0 z-20 flex items-center pe-4">
              <span className="icon-[lucide--search] ml-1 size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
            </div>
          </div>
          <Select
            name="procedure-status"
            aria-label="Filtrar status"
            selected={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "active", label: "Ativos" },
              { value: "inactive", label: "Inativos" },
              { value: "all", label: "Todos" },
            ]}
            buttonClassName="h-10 px-3 py-2 text-sm"
            className="max-w-24 shrink-0"
          />
          {canManage && (
            <Button
              type="button"
              icon="icon-[lucide--plus]"
              style="unstyled"
              className="flex size-10 shrink-0"
              title="Adicionar procedimento"
              aria-label="Adicionar procedimento"
              onClick={onAddProcedure}
            />
          )}
        </div>

        {loading ? (
          <LoadingSpinner variant="centered" className="py-8" />
        ) : procedures.length > 0 ? (
          <ListProcedures
            procedures={procedures}
            selectedId={selectedProcedureId}
            onSelect={onSelectProcedure}
          />
        ) : (
          <div className="border-b border-zinc-200 p-8 dark:border-zinc-700">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <div className="flex flex-col">
                <div className="flex justify-center pb-1">
                  <span className="icon-[lucide--search-x] size-12 shrink-0 text-zinc-300 dark:text-zinc-500" />
                </div>
                <h3 className="text-center text-base font-semibold text-zinc-600 dark:text-zinc-300">
                  Nenhum resultado
                </h3>
                <div className="text-center text-sm text-zinc-700 dark:text-zinc-400">
                  Nenhum procedimento encontrado.
                </div>
              </div>
            </div>
          </div>
        )}

        {canManage && (
          <div className="px-8 py-4">
            <div className="flex justify-center">
              <Button
                type="button"
                icon="icon-[lucide--plus]"
                style="unstyled"
                className="py-2"
                onClick={onAddProcedure}
              >
                Adicionar procedimento
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListProcedures({
  procedures,
  selectedId,
  onSelect,
}: {
  procedures: GeneralProcedureDto[];
  selectedId: string | null;
  onSelect: (procedure: GeneralProcedureDto) => void;
}) {
  return (
    <div className="flex flex-col">
      {procedures.map((procedure) => (
        <div
          key={procedure.id}
          className={`flex cursor-pointer flex-col border-b border-zinc-200 dark:border-zinc-700 ${selectedId === procedure.id ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
          onClick={() => onSelect(procedure)}
        >
          <div className="flex w-full flex-col gap-y-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            {procedure.category && (
              <div className="mb-1">
                <span className="inline-flex items-center rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                  {procedure.category}
                </span>
              </div>
            )}
            <div className="flex w-full items-center justify-between gap-x-2">
              <span className="line-clamp-2 text-base font-semibold text-zinc-700 dark:text-zinc-300">
                {procedure.title}
              </span>
              <span className={`ms-1 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${procedure.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300"}`}>
                {procedure.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
              {procedure.content.replace(/[#*_>`~-]/g, "").replace(/\s+/g, " ").trim()}
            </p>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {procedure.attachments.length} anexo(s)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
