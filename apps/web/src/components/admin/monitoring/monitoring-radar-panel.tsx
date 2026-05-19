"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import Label from "@/components/ui/label";
import Offcanvas from "@/components/ui/offcanvas";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@silo/engine/format/toast";
import { formatSlug } from "@silo/engine/format/ui";
import { config } from "@/lib/config";

import {
  RADAR_BLOCK_COLOR,
  RADAR_STATUS_UI,
  SECTION_TITLE_CLASS,
  formatDateTimeBR,
  type DbRadar,
  type DbRadarGroup,
  type RadarStatus,
  type UIRadarGroup,
  type UIRadarItem,
} from "./monitoring-page-shared";

type MonitoringRadarPanelProps = {
  radarGroups: UIRadarGroup[];
};

const NEW_GROUP_PREFIX = "new-group-";
const NEW_RADAR_PREFIX = "new-radar-";
const RADAR_STATUS_LEGEND: RadarStatus[] = ["ok", "delayed", "undefined", "off"];

function createNewRadarGroup(): DbRadarGroup {
  return {
    id: `${NEW_GROUP_PREFIX}${Date.now()}`,
    slug: "",
    name: "",
    sortOrder: 0,
  };
}

function createNewRadar(groupId: string): DbRadar {
  return {
    id: `${NEW_RADAR_PREFIX}${Date.now()}`,
    groupId,
    slug: "",
    name: "",
    description: "",
    webhookUrl: "",
    logUrl: "",
    status: "ok",
    active: true,
    delay: null,
    delayMinutes: null,
    logDate: null,
  };
}

function toEditableRadarGroup(group: UIRadarGroup): DbRadarGroup {
  return {
    id: group.id,
    slug: "slug" in group && typeof group.slug === "string" ? group.slug : "",
    name: group.name,
    sortOrder: "sortOrder" in group && typeof group.sortOrder === "number" ? group.sortOrder : 0,
  };
}

function toEditableRadar(radar: UIRadarItem, groupId: string): DbRadar {
  return {
    id: radar.id,
    groupId: "groupId" in radar && typeof radar.groupId === "string" ? radar.groupId : groupId,
    slug: "slug" in radar && typeof radar.slug === "string" ? radar.slug : "",
    name: radar.name,
    description: "description" in radar ? radar.description ?? "" : "",
    webhookUrl: "webhookUrl" in radar ? radar.webhookUrl ?? "" : "",
    logUrl: "logUrl" in radar ? radar.logUrl ?? "" : "",
    status: "status" in radar ? radar.status : "ok",
    delay: "delay" in radar ? radar.delay : null,
    delayMinutes: "delayMinutes" in radar ? radar.delayMinutes : null,
    logDate: "logDate" in radar ? radar.logDate : null,
    active: "active" in radar ? radar.active : true,
  };
}

export default function MonitoringRadarPanel({ radarGroups }: MonitoringRadarPanelProps) {
  const router = useRouter();
  const [selectedRadar, setSelectedRadar] = useState<{
    groupName: string;
    radar: UIRadarItem;
  } | null>(null);
  const [isManagingRadars, setIsManagingRadars] = useState(false);
  const [editingRadarGroup, setEditingRadarGroup] = useState<DbRadarGroup | null>(null);
  const [editingRadar, setEditingRadar] = useState<DbRadar | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<DbRadarGroup | null>(null);
  const [radarToDelete, setRadarToDelete] = useState<DbRadar | null>(null);

  const handleDeleteRadar = async (radarId: string) => {
    try {
      const res = await fetch(config.getApiUrl(`/api/admin/monitoring/radars?id=${radarId}`), {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir radar");
      }

      toast({
        type: "success",
        title: "Sucesso",
        description: "Radar excluído com sucesso!",
      });
      setEditingRadar(null);
      setRadarToDelete(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        title: "Erro",
        description: "Não foi possível excluir o radar.",
      });
    }
  };

  const handleDeleteRadarGroup = async (groupId: string) => {
    try {
      const res = await fetch(config.getApiUrl(`/api/admin/monitoring/radar-groups?id=${groupId}`), {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json() as { message?: string };
        throw new Error(errorData.message || "Erro ao excluir grupo");
      }

      toast({
        type: "success",
        title: "Sucesso",
        description: "Grupo excluído com sucesso!",
      });
      setEditingRadarGroup(null);
      setGroupToDelete(null);
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível excluir o grupo.";
      toast({
        type: "error",
        title: "Erro",
        description: errorMessage,
      });
    }
  };

  const handleSaveRadarGroup = async () => {
    if (!editingRadarGroup) {
      return;
    }

    try {
      const slug = editingRadarGroup.slug || formatSlug(editingRadarGroup.name);
      const res = await fetch(config.getApiUrl("/api/admin/monitoring/radar-groups"), {
        method: editingRadarGroup.id.includes(NEW_GROUP_PREFIX) ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingRadarGroup, slug }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar grupo");
      }

      toast({ type: "success", title: "Sucesso", description: "Grupo salvo!" });
      setEditingRadarGroup(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Erro", description: "Não foi possível salvar o grupo." });
    }
  };

  const handleSaveRadar = async () => {
    if (!editingRadar) {
      return;
    }

    try {
      const slug = editingRadar.slug || formatSlug(editingRadar.name);
      const res = await fetch(config.getApiUrl("/api/admin/monitoring/radars"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingRadar, slug }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar radar");
      }

      toast({ type: "success", title: "Sucesso", description: "Radar configurado!" });
      setEditingRadar(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Erro", description: "Não foi possível salvar o radar." });
    }
  };

  return (
    <aside className="scrollbar w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-t border-zinc-200 lg:min-h-0 lg:w-100 lg:max-w-100 lg:border-l lg:border-t-0 dark:border-zinc-700">
      <div className="p-8">
        <div className="flex flex-col">
          <div className="flex items-start justify-between">
            <h3 className={SECTION_TITLE_CLASS}>Radares</h3>
            <Button
              style="unstyled"
              className="-mt-1 size-10 rounded-md p-0 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setIsManagingRadars(true)}
              title="Gerenciar grupos e webhooks"
            >
              <span className="icon-[lucide--settings-2] size-5 text-zinc-500" />
            </Button>
          </div>
          <div className="space-y-3 text-base">
            <p>
              Acompanhe o estado atual dos radares por grupo e identifique
              rapidamente atrasos.
            </p>

            <p className="flex justify-center text-sm text-zinc-600 dark:text-zinc-400">
              <span className="icon-[lucide--alert-triangle] size-6" />
              <span className="ml-1">
                Clique em um radar para ver descricao, data do log, URL, atraso e status.
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-6 pt-6">
          {radarGroups.map((group) => (
            <section key={group.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  {group.name}
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.radars.map((radar) => {
                  const initial = radar.name.charAt(0).toUpperCase();
                  const statusUi = RADAR_STATUS_UI[radar.status as RadarStatus] || RADAR_STATUS_UI.undefined;
                  const delayLabel = radar.delay ?? "sem atraso";

                  return (
                    <button
                      key={radar.id}
                      type="button"
                      title={`${radar.name} - atraso ${delayLabel}`}
                      className={`flex size-12 items-center justify-center rounded-md ${RADAR_BLOCK_COLOR[radar.status as RadarStatus] || RADAR_BLOCK_COLOR.undefined} ${statusUi.squareTextClass} text-sm font-semibold shadow-sm transition-transform duration-150 hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400`}
                      onClick={() =>
                        setSelectedRadar({ groupName: group.name, radar })
                      }
                    >
                      {initial}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Legenda
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {RADAR_STATUS_LEGEND.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${RADAR_STATUS_UI[status].badgeClass}`}
              >
                {RADAR_STATUS_UI[status].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedRadar}
        onClose={() => setSelectedRadar(null)}
        title={selectedRadar?.radar.name}
        description={selectedRadar ? `Grupo ${selectedRadar.groupName}` : undefined}
        size="md"
      >
        {selectedRadar && (
          <div className="space-y-3 p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Radar</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedRadar.radar.name}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Situação</p>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${RADAR_STATUS_UI[(selectedRadar.radar.status as RadarStatus) || "undefined"].badgeClass}`}
                >
                  {RADAR_STATUS_UI[(selectedRadar.radar.status as RadarStatus) || "undefined"].label}
                </span>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Data do log</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatDateTimeBR(selectedRadar.radar.logDate)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Atraso</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedRadar.radar.delay ?? "Sem atraso"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Descricao</p>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                {selectedRadar.radar.description ?? "Sem descrição"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">URL do log</p>
              <a
                href={selectedRadar.radar.logUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedRadar.radar.logUrl || "Sem URL de log"}
              </a>
            </div>
          </div>
        )}
      </Dialog>

      <Offcanvas
        open={isManagingRadars}
        onClose={() => setIsManagingRadars(false)}
        title="Gerenciar Radares"
        width="lg"
      >
        <div className="space-y-8 p-1">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Grupos de Radares</h4>
              <Button onClick={() => setEditingRadarGroup(createNewRadarGroup())}>
                Novo Grupo
              </Button>
            </div>
            <div className="space-y-2">
              {radarGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <span className="font-medium">{group.name}</span>
                  <div className="flex gap-1">
                    <Button
                      style="unstyled"
                      className="p-2"
                      onClick={() => setEditingRadarGroup(toEditableRadarGroup(group))}
                    >
                      <span className="icon-[lucide--pencil] size-4" />
                    </Button>
                    <Button
                      style="unstyled"
                      className="flex h-auto items-center px-2 py-1 text-sm"
                      onClick={() => setEditingRadar(createNewRadar(group.id))}
                    >
                      <span className="icon-[lucide--plus] size-4" />
                      Novo radar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="border-b border-zinc-200 pb-2 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">Webhooks e Configurações</h4>
            {radarGroups.map((group) => (
              <div key={`manage-${group.id}`} className="space-y-3">
                <h5 className="text-base font-bold uppercase text-zinc-500">{group.name}</h5>
                <div className="grid grid-cols-1 gap-3">
                  {group.radars.map((radar) => {
                    const webhookUrl = "webhookUrl" in radar ? radar.webhookUrl : "";
                    const editableRadar = toEditableRadar(radar, group.id);

                    return (
                      <div key={radar.id} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{radar.name}</p>
                          <p className="truncate text-xs text-zinc-500">{webhookUrl || "Sem webhook configurado"}</p>
                        </div>
                        <Button style="unstyled" className="p-2" onClick={() => setEditingRadar(editableRadar)}>
                          <span className="icon-[lucide--settings] size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Offcanvas>

      <Offcanvas
        open={!!editingRadarGroup}
        onClose={() => setEditingRadarGroup(null)}
        title={editingRadarGroup?.id.includes(NEW_GROUP_PREFIX) ? "Novo Grupo" : "Editar Grupo"}
        width="md"
        zIndex={80}
        footerActions={
          <div className="flex w-full items-center justify-between">
            <div>
              {editingRadarGroup && !editingRadarGroup.id.includes(NEW_GROUP_PREFIX) && (
                <Button
                  style="bordered"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={() => setGroupToDelete(editingRadarGroup)}
                >
                  <span className="icon-[lucide--trash-2] mr-1 size-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button style="bordered" onClick={() => setEditingRadarGroup(null)}>Cancelar</Button>
              <Button onClick={handleSaveRadarGroup}>Salvar</Button>
            </div>
          </div>
        }
      >
        {editingRadarGroup && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input
                type="text"
                value={editingRadarGroup.name}
                setValue={(v) => setEditingRadarGroup({ ...editingRadarGroup, name: v })}
                required
              />
            </div>
          </div>
        )}
      </Offcanvas>

      <Offcanvas
        open={!!editingRadar}
        onClose={() => setEditingRadar(null)}
        title="Configurar Radar"
        width="md"
        zIndex={80}
        footerActions={
          <div className="flex w-full items-center justify-between">
            <div>
              {editingRadar && !editingRadar.id.includes(NEW_RADAR_PREFIX) && (
                <Button
                  style="bordered"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={() => setRadarToDelete(editingRadar)}
                >
                  <span className="icon-[lucide--trash-2] mr-1 size-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button style="bordered" onClick={() => setEditingRadar(null)}>Cancelar</Button>
              <Button onClick={handleSaveRadar}>Salvar Configurações</Button>
            </div>
          </div>
        }
      >
        {editingRadar && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Radar</Label>
              <Input
                type="text"
                value={editingRadar.name}
                setValue={(v) => setEditingRadar({ ...editingRadar, name: v })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <select
                className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                value={editingRadar.groupId}
                onChange={(e) => setEditingRadar({ ...editingRadar, groupId: e.target.value })}
              >
                {radarGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                type="text"
                value={editingRadar.webhookUrl || ""}
                setValue={(v) => setEditingRadar({ ...editingRadar, webhookUrl: v })}
                placeholder="https://hooks.example.com/..."
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Funciona como um mensageiro que avisa imediatamente quando os dados forem atualizados.
              </p>
            </div>
            <div className="space-y-2">
              <Label>URL do Log</Label>
              <Input
                type="text"
                value={editingRadar.logUrl || ""}
                setValue={(v) => setEditingRadar({ ...editingRadar, logUrl: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editingRadar.description || ""}
                onChange={(e) => setEditingRadar({ ...editingRadar, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        )}
      </Offcanvas>

      <Dialog
        open={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        title="Confirmar Exclusão de Grupo"
        size="sm"
      >
        <div className="p-6">
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            Tem certeza que deseja excluir o grupo <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{groupToDelete?.name}&quot;</span>?
            Esta ação removerá o grupo da organização. O grupo deve estar vazio.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setGroupToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="border-transparent bg-red-600 text-white hover:bg-red-700"
              onClick={() => groupToDelete && handleDeleteRadarGroup(groupToDelete.id)}
            >
              Excluir Grupo
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!radarToDelete}
        onClose={() => setRadarToDelete(null)}
        title="Confirmar Exclusão de Radar"
        size="sm"
      >
        <div className="p-6">
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            Tem certeza que deseja excluir o radar <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{radarToDelete?.name}&quot;</span>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setRadarToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="border-transparent bg-red-600 text-white hover:bg-red-700"
              onClick={() => radarToDelete && handleDeleteRadar(radarToDelete.id)}
            >
              Excluir Radar
            </Button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
