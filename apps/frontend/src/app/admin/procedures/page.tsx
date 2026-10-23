"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@silo/engine/format/toast";
import type {
  GeneralProcedureAttachmentDto,
  GeneralProcedureDto,
} from "@silo/engine/contracts/dto/procedures";
import { useUser } from "@/context/user-context";
import type { ApiResponse } from "@/lib/api-response";
import { config } from "@/lib/config";
import { ProcedureDetailColumn } from "./components/procedure-detail-column";
import { ProcedureFormOffcanvas, type ProcedureForm } from "./components/procedure-form-offcanvas";
import { ProcedureListColumn } from "./components/procedure-list-column";

type StatusFilter = "all" | "active" | "inactive";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      const payload = (await response.json()) as ApiResponse<{ items: GeneralProcedureDto[] }>;
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

  function openNewProcedure() {
    setSelected(null);
    setForm(emptyForm);
    setDescription("");
    setDrawerOpen(true);
  }

  function openEditProcedure() {
    if (!selected || !canManage) return;
    setDrawerOpen(true);
  }

  async function saveProcedure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    if (!form.title.trim() || !form.content.trim()) {
      toast({ type: "error", title: "Campos obrigatórios", description: "Informe título e conteúdo." });
      return;
    }

    const editing = Boolean(selected);
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
      const payload = (await response.json()) as ApiResponse<{ procedure: GeneralProcedureDto }>;
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
      setDrawerOpen(false);
      toast({ type: "success", title: editing ? "Procedimento atualizado" : "Procedimento criado", description: "A indexação será atualizada em segundo plano." });
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
      setDrawerOpen(false);
      setSelected(null);
      setForm(emptyForm);
      toast({ type: "success", title: "Procedimento excluído", description: "Os anexos físicos também foram removidos." });
      await loadProcedures();
    } catch (error) {
      toast({ type: "error", title: "Erro ao excluir procedimento", description: error instanceof Error ? error.message : "Tente novamente." });
    }
  }

  async function refreshSelected(id: string) {
    const response = await fetch(config.getApiUrl(`/api/procedures/${id}`));
    const payload = (await response.json()) as ApiResponse<{ procedure: GeneralProcedureDto }>;
    if (response.ok && payload.success && payload.data?.procedure) selectProcedure(payload.data.procedure);
  }

  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selected || !canManage) return;
    try {
      setUploading(true);
      const body = new FormData();
      body.append("file", file);
      if (description.trim()) body.append("description", description.trim());
      const response = await fetch(config.getApiUrl(`/api/procedures/${selected.id}/attachments`), { method: "POST", body });
      const payload = (await response.json()) as ApiResponse<{ attachment: GeneralProcedureAttachmentDto }>;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? payload.message ?? "Não foi possível adicionar o anexo.");
      setDescription("");
      setFileInputKey((value) => value + 1);
      toast({ type: "success", title: "Anexo adicionado", description: "O texto será indexado para consulta da IA." });
      await refreshSelected(selected.id);
      await loadProcedures();
    } catch (error) {
      toast({ type: "error", title: "Erro ao adicionar anexo", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setUploading(false);
    }
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
    <>
      <div className="flex w-full">
        <ProcedureListColumn
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          procedures={procedures}
          selectedProcedureId={selected?.id ?? null}
          loading={loading}
          canManage={canManage}
          onAddProcedure={openNewProcedure}
          onSelectProcedure={selectProcedure}
        />
        <div className="flex w-full grow flex-col">
          <div className="scrollbar size-full h-[calc(100vh-140px)] overflow-y-auto">
            <ProcedureDetailColumn
              procedure={selected}
              canManage={canManage}
              onAddProcedure={openNewProcedure}
              onEditProcedure={openEditProcedure}
            />
          </div>
        </div>
      </div>

      <ProcedureFormOffcanvas
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={selected}
        form={form}
        setForm={setForm}
        onSubmit={saveProcedure}
        saving={saving}
        canManage={canManage}
        onDelete={() => void deleteProcedure()}
        description={description}
        setDescription={setDescription}
        fileInputKey={fileInputKey}
        uploading={uploading}
        onUpload={(event) => void uploadAttachment(event)}
        onRemoveAttachment={(attachment) => void removeAttachment(attachment)}
        onReprocessAttachment={(attachment) => void reprocessAttachment(attachment)}
      />
    </>
  );
}
