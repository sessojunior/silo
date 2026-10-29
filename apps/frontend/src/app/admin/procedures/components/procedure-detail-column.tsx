"use client";

import ReactMarkdown from "react-markdown";
import type { GeneralProcedureDto } from "@silo/engine/contracts/dto/procedures";
import Button from "@/components/ui/button";
import { toPublicUploadsSrc } from "@/lib/uploads";

interface ProcedureDetailColumnProps {
  procedure: GeneralProcedureDto | null;
  canManage: boolean;
  onAddProcedure: () => void;
  onEditProcedure: () => void;
}

export function ProcedureDetailColumn({
  procedure,
  canManage,
  onAddProcedure,
  onEditProcedure,
}: ProcedureDetailColumnProps) {
  if (!procedure) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <span className="icon-[lucide--book-open] mx-auto mb-4 block size-12 text-zinc-300 dark:text-zinc-600" />
          <h2 className="text-xl font-medium text-zinc-800 dark:text-zinc-200">
            Procedimentos gerais
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Selecione um procedimento para consultar os detalhes ou cadastre um
            novo procedimento operacional.
          </p>
          {canManage && (
            <Button
              type="button"
              icon="icon-[lucide--plus]"
              className="mt-6"
              onClick={onAddProcedure}
            >
              Adicionar procedimento
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col p-8">
      <div className="flex w-full items-start justify-between gap-4 pb-6">
        <div>
          <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
            {procedure.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            {procedure.category && <span>{procedure.category}</span>}
            {procedure.category && (
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
            )}
            <span
              className={
                procedure.active ? "text-emerald-600" : "text-zinc-500"
              }
            >
              {procedure.active ? "Ativo" : "Inativo"}
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">•</span>
            <span>{procedure.attachments.length} anexo(s)</span>
          </div>
        </div>
        {canManage && (
          <Button
            type="button"
            icon="icon-[lucide--edit]"
            style="unstyled"
            className="shrink-0 py-2"
            onClick={onEditProcedure}
          >
            Editar procedimento
          </Button>
        )}
      </div>

      <div className="prose prose-sm max-w-none text-zinc-800 dark:prose-invert dark:text-zinc-200">
        <ReactMarkdown>{procedure.content}</ReactMarkdown>
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
              Anexos
            </h4>
            <p className="mt-1 text-sm text-zinc-500">
              Arquivos consultáveis pela IA junto com este procedimento.
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {procedure.attachments.length} arquivo(s)
          </span>
        </div>
        {procedure.attachments.length > 0 ? (
          <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {procedure.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={toPublicUploadsSrc(attachment.url)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-1 py-4 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span className="flex min-w-0 items-center gap-2 truncate font-medium text-blue-600">
                  <span
                    className={
                      attachment.kind === "image"
                        ? "icon-[lucide--image] size-4"
                        : "icon-[lucide--file-text] size-4"
                    }
                  />
                  {attachment.originalName}
                </span>
                <span
                  className={`shrink-0 text-xs ${attachment.extractionStatus === "ready" ? "text-emerald-600" : attachment.extractionStatus === "error" ? "text-red-600" : "text-amber-600"}`}
                >
                  {attachment.extractionStatus === "ready"
                    ? "Pronto"
                    : attachment.extractionStatus === "error"
                      ? "Erro"
                      : "Processando"}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Nenhum anexo registrado.</p>
        )}
      </div>
    </div>
  );
}
