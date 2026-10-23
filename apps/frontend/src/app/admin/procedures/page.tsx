"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "@silo/engine/format/toast";
import type {
  GeneralProcedureAttachmentDto,
  GeneralProcedureDto,
} from "@silo/engine/contracts/dto/procedures";
import Button from "@/components/ui/button";
import Label from "@/components/ui/label";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useUser } from "@/context/user-context";
import type { ApiResponse } from "@/lib/api-response";
import { config } from "@/lib/config";

type StatusFilter = "all" | "active" | "inactive";

type ProcedureForm = {
  title: string;
  category: string;
  content: string;
  active: boolean;
};

const emptyForm: ProcedureForm = {
  title: "",
  category: "",
  content: "",
  active: true,
};

export default function ProceduresPage() {
  const { isAdmin, hasPermission } = useUser();
  const canManage = isAdmin || hasPermission("procedures", "manage");
  const [procedures, setProcedures] = useState<GeneralProcedureDto[]>([]);
  const [selected, setSelected] = useState<GeneralProcedureDto | null>(null);
  const [form, setForm] = useState<ProcedureForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ page: "1", limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("active", String(statusFilter === "active"));
    return `/api/procedures?${params.toString()}`;
  }, [search, statusFilter]);

  const loadProcedures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(config.getApiUrl(listUrl));
      const payload = (await response.json()) as ApiResponse<{
        items: GeneralProcedureDto[];
      }>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? payload.message ?? "Não foi possível listar os procedimentos.");
      }
      setProcedures(payload.data?.items ?? []);
    } catch (error) {
      toast({
        type: "error",
        title: "Erro ao carregar procedimentos",
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void loadProcedures();
  }, [loadProcedures]);

  function selectProcedure(procedure: GeneralProcedureDto) {
    setSelected(procedure);
    setForm({
      title: procedure.title,
      category: procedure.category ?? "",
      content: procedure.content,
      active: procedure.active,
    });
    setDescription("");
  }

  function startNew() {
    setSelected(null);
    setForm(emptyForm);
    setDescription("");
  }

  async function saveProcedure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast({ type: "error", title: "Campos obrigatórios", description: "Informe título e conteúdo." });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        config.getApiUrl(selected ? `/api/procedures/${selected.id}` : "/api/procedures"),
        {
          method: selected ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, category: form.category.trim() || null }),
        },
      );
      const payload = (await response.json()) as ApiResponse<{
        procedure: GeneralProcedureDto;
      }>;
      if (!response.ok || !payload.success || !payload.data?.procedure) {
        throw new Error(payload.error ?? payload.message ?? "Não foi possível salvar o procedimento.");
      }
      setSelected(payload.data.procedure);
      setForm({
        title: payload.data.procedure.title,
        category: payload.data.procedure.category ?? "",
        content: payload.data.procedure.content,
        active: payload.data.procedure.active,
      });
      toast({ type: "success", title: selected ? "Procedimento atualizado" : "Procedimento criado", description: "A indexação será atualizada em segundo plano." });
      await loadProcedures();
    } catch (error) {
      toast({ type: "error", title: "Erro ao salvar procedimento", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteProcedure() {
    if (!selected || !canManage || !window.confirm(`Excluir “${selected.title}” e seus anexos?`)) return;
    try {
      const response = await fetch(config.getApiUrl(`/api/procedures/${selected.id}`), { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<null>;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Não foi possível excluir o procedimento.");
      toast({ type: "success", title: "Procedimento excluído", description: "Os anexos físicos também foram removidos." });
      startNew();
      await loadProcedures();
    } catch (error) {
      toast({ type: "error", title: "Erro ao excluir procedimento", description: error instanceof Error ? error.message : "Tente novamente." });
    }
  }

  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected || !canManage) return;
    try {
      setUploading(true);
      const body = new FormData();
      body.append("file", file);
      if (description.trim()) body.append("description", description.trim());
      const response = await fetch(config.getApiUrl(`/api/procedures/${selected.id}/attachments`), {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as ApiResponse<{
        attachment: GeneralProcedureAttachmentDto;
      }>;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? payload.message ?? "Não foi possível adicionar o anexo.");
      toast({ type: "success", title: "Anexo adicionado", description: "O texto será indexado para consulta da IA." });
      setDescription("");
      setFileInputKey((value) => value + 1);
      await refreshSelected(selected.id);
      await loadProcedures();
    } catch (error) {
      toast({ type: "error", title: "Erro ao adicionar anexo", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setUploading(false);
    }
  }

  async function refreshSelected(id: string) {
    const response = await fetch(config.getApiUrl(`/api/procedures/${id}`));
    const payload = (await response.json()) as ApiResponse<{ procedure: GeneralProcedureDto }>;
    if (response.ok && payload.success && payload.data?.procedure) selectProcedure(payload.data.procedure);
  }

  async function removeAttachment(attachment: GeneralProcedureAttachmentDto) {
    if (!selected || !canManage || !window.confirm(`Remover “${attachment.originalName}”?`)) return;
    const response = await fetch(config.getApiUrl(`/api/procedures/${selected.id}/attachments/${attachment.id}`), { method: "DELETE" });
    const payload = (await response.json()) as ApiResponse<null>;
    if (!response.ok || !payload.success) {
      toast({ type: "error", title: "Erro ao remover anexo", description: payload.error ?? "Tente novamente." });
      return;
    }
    toast({ type: "success", title: "Anexo removido", description: "O arquivo e a indexação foram removidos." });
    await refreshSelected(selected.id);
    await loadProcedures();
  }

  async function reprocessAttachment(attachment: GeneralProcedureAttachmentDto) {
    if (!selected || !canManage) return;
    const response = await fetch(config.getApiUrl(`/api/procedures/${selected.id}/attachments/${attachment.id}/reprocess`), { method: "POST" });
    const payload = (await response.json()) as ApiResponse<null>;
    if (!response.ok || !payload.success) {
      toast({ type: "error", title: "Erro ao reprocessar anexo", description: payload.error ?? "Tente novamente." });
      return;
    }
    toast({ type: "success", title: "Anexo reprocessado", description: "A indexação será atualizada em segundo plano." });
    await refreshSelected(selected.id);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">Base operacional da IA</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Procedimentos gerais</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Registre soluções avulsas, manuais de operação e anexos que devem orientar a resolução de problemas.
          </p>
        </div>
        {canManage && <Button icon="icon-[lucide--plus]" onClick={startNew}>Novo procedimento</Button>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input aria-label="Buscar procedimentos" className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700" placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filtrar status" className="rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? <LoadingSpinner variant="centered" className="py-8" /> : procedures.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">Nenhum procedimento encontrado.</p> : procedures.map((procedure) => (
              <button key={procedure.id} type="button" onClick={() => selectProcedure(procedure)} className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === procedure.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-zinc-200 hover:border-blue-300 dark:border-zinc-700"}`}>
                <div className="flex items-start justify-between gap-3"><span className="font-medium text-zinc-900 dark:text-zinc-100">{procedure.title}</span><span className={`rounded-full px-2 py-0.5 text-[11px] ${procedure.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{procedure.active ? "Ativo" : "Inativo"}</span></div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{procedure.category || "Sem categoria"} · {procedure.attachments.length} anexo(s)</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <form onSubmit={saveProcedure} className="space-y-4">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{selected ? "Editar procedimento" : "Novo procedimento"}</h2>{selected && canManage && <Button type="button" style="unstyled" className="text-red-600 hover:bg-red-50 dark:text-red-400" onClick={() => void deleteProcedure()}>Excluir</Button>}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label htmlFor="procedure-title" required>Título</Label><input id="procedure-title" required disabled={!canManage} className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-zinc-700" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
              <div><Label htmlFor="procedure-category">Categoria</Label><input id="procedure-category" disabled={!canManage} className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-zinc-700" placeholder="Ex.: infraestrutura" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
            </div>
            <div><Label htmlFor="procedure-content" required>Conteúdo (Markdown)</Label><textarea id="procedure-content" required disabled={!canManage} className="min-h-64 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2.5 font-mono text-sm leading-6 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-zinc-700" placeholder="## Procedimento\n\nDescreva o passo a passo..." value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"><input type="checkbox" disabled={!canManage} checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Disponível para consulta da IA</label>
            {canManage && <Button type="submit" loading={saving} icon="icon-[lucide--save]">Salvar procedimento</Button>}
          </form>

          {selected && <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Anexos</h3><p className="mt-1 text-xs text-zinc-500">PDF, TXT, MD, DOCX, PPTX e imagens. Descreva a imagem para que o modelo textual possa consultá-la.</p></div><span className="text-xs text-zinc-500">{selected.attachments.length} arquivo(s)</span></div>
            {canManage && <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-600"><input key={fileInputKey} type="file" accept="image/*,.pdf,.txt,.md,.docx,.pptx" disabled={uploading} onChange={(event) => void uploadAttachment(event)} /><input aria-label="Descrição da imagem" className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" placeholder="Descrição/OCR da imagem (recomendado para a IA)" value={description} onChange={(event) => setDescription(event.target.value)} />{uploading && <LoadingSpinner text="Processando anexo..." size="sm" />}</div>}
            <div className="mt-4 space-y-2">{selected.attachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} canManage={canManage} onDelete={() => void removeAttachment(attachment)} onReprocess={() => void reprocessAttachment(attachment)} />)}</div>
          </div>}

          {selected && <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700"><h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Pré-visualização</h3><article className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{selected.content}</ReactMarkdown></article></div>}
        </section>
      </div>
    </div>
  );
}

function AttachmentRow({ attachment, canManage, onDelete, onReprocess }: { attachment: GeneralProcedureAttachmentDto; canManage: boolean; onDelete: () => void; onReprocess: () => void }) {
  const statusClass = attachment.extractionStatus === "ready" ? "text-emerald-600" : attachment.extractionStatus === "error" ? "text-red-600" : "text-amber-600";
  return <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><a className="flex items-center gap-2 truncate text-sm font-medium text-blue-600 hover:underline" href={attachment.url} target="_blank" rel="noreferrer"><span className={attachment.kind === "image" ? "icon-[lucide--image] size-4" : "icon-[lucide--file-text] size-4"} />{attachment.originalName}</a><p className={`mt-1 text-xs ${statusClass}`}>{attachment.extractionStatus === "ready" ? "Pronto para consulta" : attachment.extractionStatus === "error" ? `Erro: ${attachment.extractionError ?? "extração falhou"}` : "Processando..."}</p></div>{canManage && <div className="flex gap-1"><Button type="button" style="unstyled" className="px-2 py-1 text-xs" onClick={onReprocess}>Reprocessar</Button><Button type="button" style="unstyled" className="px-2 py-1 text-xs text-red-600" onClick={onDelete}>Remover</Button></div>}</div>;
}
