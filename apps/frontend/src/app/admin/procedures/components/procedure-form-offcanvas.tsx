"use client";

import { useRef, type ChangeEvent, type FormEvent } from "react";
import type {
  GeneralProcedureAttachmentDto,
  GeneralProcedureDto,
} from "@silo/engine/contracts/dto/procedures";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import InputCheckbox from "@/components/ui/input-checkbox";
import Label from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";
import MarkdownEditor from "@/components/ui/markdown-editor";
import { compactMarkdownEditorOptions } from "@/components/ui/markdown-editor-config";
import Offcanvas from "@/components/ui/offcanvas";
import { toPublicUploadsSrc } from "@/lib/uploads";

export type ProcedureForm = {
  title: string;
  category: string;
  content: string;
  active: boolean;
};

interface ProcedureFormOffcanvasProps {
  open: boolean;
  onClose: () => void;
  editing: GeneralProcedureDto | null;
  form: ProcedureForm;
  setForm: (form: ProcedureForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  canManage: boolean;
  onDelete: () => void;
  description: string;
  setDescription: (value: string) => void;
  fileInputKey: number;
  uploading: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (attachment: GeneralProcedureAttachmentDto) => void;
  onReprocessAttachment: (attachment: GeneralProcedureAttachmentDto) => void;
}

export function ProcedureFormOffcanvas({
  open,
  onClose,
  editing,
  form,
  setForm,
  onSubmit,
  saving,
  canManage,
  onDelete,
  description,
  setDescription,
  fileInputKey,
  uploading,
  onUpload,
  onRemoveAttachment,
  onReprocessAttachment,
}: ProcedureFormOffcanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Offcanvas
      open={open}
      onClose={onClose}
      title={editing ? "Editar procedimento" : "Adicionar procedimento"}
      width="xl"
      footerActions={
        <div className="flex w-full items-center justify-between gap-2">
          {editing ? (
            <Button
              type="button"
              style="bordered"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              onClick={onDelete}
            >
              Excluir procedimento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" style="bordered" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="procedure-form"
              loading={saving}
              disabled={!canManage}
            >
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="procedure-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-6"
      >
        <div>
          <Label htmlFor="procedure-title" required>
            Título do procedimento
          </Label>
          <Input
            id="procedure-title"
            type="text"
            required
            disabled={!canManage}
            value={form.title}
            setValue={(value) => setForm({ ...form, title: value })}
          />
        </div>
        <div>
          <Label htmlFor="procedure-category">Categoria</Label>
          <Input
            id="procedure-category"
            type="text"
            disabled={!canManage}
            value={form.category}
            setValue={(value) => setForm({ ...form, category: value })}
            placeholder="Ex.: infraestrutura"
          />
        </div>
        <div>
          <Label htmlFor="procedure-content" required>
            Conteúdo (Markdown)
          </Label>
          <div className="mt-2">
            <MarkdownEditor
              id="procedure-content"
              value={form.content}
              onChange={(value) => setForm({ ...form, content: value })}
              options={compactMarkdownEditorOptions}
            />
          </div>
        </div>
        <InputCheckbox
          id="procedure-active"
          name="active"
          label="Disponível para consulta da IA"
          disabled={!canManage}
          checked={form.active}
          onChange={(event) =>
            setForm({ ...form, active: event.target.checked })
          }
        />

        {editing && (
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Anexos
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Arquivos que a IA poderá consultar com este procedimento.
                </p>
              </div>
              <span className="text-sm text-zinc-500">
                {editing.attachments.length} arquivo(s)
              </span>
            </div>
            {canManage && (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    key={fileInputKey}
                    type="file"
                    accept="image/*,.pdf,.txt,.md,.docx,.pptx"
                    disabled={uploading}
                    onChange={onUpload}
                    className="sr-only"
                  />
                  <Button
                    type="button"
                    style="bordered"
                    icon="icon-[lucide--paperclip]"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Adicionar arquivo
                  </Button>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    PDF, TXT, MD, DOCX, PPTX e imagens
                  </span>
                </div>
                <div className="mt-3">
                  <Label htmlFor="procedure-attachment-description">
                    Descrição/OCR da imagem
                  </Label>
                  <Input
                    id="procedure-attachment-description"
                    type="text"
                    value={description}
                    setValue={setDescription}
                    placeholder="Recomendado para a IA"
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <LoadingSpinner text="Processando anexo..." size="sm" />
                )}
              </div>
            )}
            <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {editing.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex flex-col gap-2 px-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <a
                      className="flex items-center gap-2 truncate text-sm font-medium text-blue-600 hover:underline"
                      href={toPublicUploadsSrc(attachment.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span
                        className={
                          attachment.kind === "image"
                            ? "icon-[lucide--image] size-4"
                            : "icon-[lucide--file-text] size-4"
                        }
                      />
                      {attachment.originalName}
                    </a>
                    <p
                      className={`mt-1 text-xs ${attachment.extractionStatus === "ready" ? "text-emerald-600" : attachment.extractionStatus === "error" ? "text-red-600" : "text-amber-600"}`}
                    >
                      {attachment.extractionStatus === "ready"
                        ? "Pronto para consulta"
                        : attachment.extractionStatus === "error"
                          ? `Erro: ${attachment.extractionError ?? "extração falhou"}`
                          : "Processando..."}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        style="unstyled"
                        className="px-2 py-1 text-xs"
                        onClick={() => onReprocessAttachment(attachment)}
                      >
                        Reprocessar
                      </Button>
                      <Button
                        type="button"
                        style="unstyled"
                        className="px-2 py-1 text-xs text-red-600"
                        onClick={() => onRemoveAttachment(attachment)}
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Offcanvas>
  );
}
