"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";

import ProductMonitoringCards, {
  type MonitoringProductItem,
  type MonitoringProductsFile,
} from "@/components/admin/monitoring/ProductMonitoringCards";
import Stats, { type StatItem } from "@/components/admin/dashboard/Stats";
import Dialog from "@/components/ui/Dialog";
import PicturePagesAccordion, { type PicturePage, type PictureLink, type PictureLinkStatus } from "./PicturePagesAccordion";
import PicturePagesTable from "./PicturePagesTable";
import picturesJson from "@/app/admin/monitoring/pictures.json";
import radarsJson from "@/app/admin/monitoring/radars.json";
import Offcanvas from "@/components/ui/Offcanvas";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import Label from "@/components/ui/Label";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";
import { formatSlug } from "@/lib/utils";

type RadarStatus = "ok" | "delayed" | "undefined" | "off";
type RadarItem = {
  id: string;
  name: string;
  description: string;
  logDate: string;
  logUrl: string;
  delay: string;
  delayMinutes: number | null;
  status: RadarStatus;
};

type RadarGroup = {
  id: string;
  name: string;
  radars: RadarItem[];
};

type RadarFile = {
  groups: RadarGroup[];
};

type UIRadarGroup = RadarGroup | (DbRadarGroup & { radars: DbRadar[] });
type UIRadarItem = RadarItem | DbRadar;

// Tipos para o Banco de Dados (vêm das tabelas que criamos)
export type DbRadarGroup = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type DbRadar = {
  id: string;
  groupId: string;
  slug: string;
  name: string;
  description: string | null;
  webhookUrl: string | null;
  logUrl: string | null;
  status: string;
  delay: string | null;
  delayMinutes: number | null;
  logDate: string | Date | null;
  active: boolean;
};

const RADAR_STATUS_UI: Record<
  RadarStatus,
  { badgeClass: string; label: string; squareTextClass: string }
> = {
  ok: {
    badgeClass: "bg-green-500 text-white",
    label: "Sem atraso",
    squareTextClass: "text-white",
  },
  delayed: {
    badgeClass: "bg-red-500 text-white",
    label: "Com atraso",
    squareTextClass: "text-white",
  },
  undefined: {
    badgeClass: "bg-zinc-400 text-white dark:bg-zinc-500",
    label: "Indefinido",
    squareTextClass: "text-white",
  },
  off: {
    badgeClass: "bg-white text-zinc-700 border border-zinc-300 dark:bg-zinc-100",
    label: "Desativado",
    squareTextClass: "text-zinc-700",
  },
};

const RADAR_BLOCK_COLOR: Record<RadarStatus, string> = {
  ok: "bg-green-500",
  delayed: "bg-red-500",
  undefined: "bg-zinc-400 dark:bg-zinc-500",
  off: "bg-white border border-zinc-300 dark:bg-zinc-100",
};

const SECTION_TITLE_CLASS = "pb-4 text-2xl font-medium text-zinc-900 dark:text-zinc-100";

function getProductSummaryStatus(turns: MonitoringProductItem["turns"]):
  | "ran"
  | "problem"
  | "not_run" {
  const statuses = turns.map((turn) => turn.status);

  if (
    statuses.some(
      (status) =>
        status === "with_problems" ||
        status === "run_again" ||
        status === "under_support",
    )
  ) {
    return "problem";
  }

  if (statuses.some((status) => status === "completed")) {
    return "ran";
  }

  return "not_run";
}

type MonitoringPageClientProps = {
  productsData: MonitoringProductsFile;
  picturePages?: PicturePage[];
  radarGroups?: DbRadarGroup[];
  radars?: DbRadar[];
};

export default function MonitoringPageClient({
  productsData,
  picturePages,
  radarGroups,
  radars,
}: MonitoringPageClientProps) {
  const [selectedRadar, setSelectedRadar] = useState<{
    groupName: string;
    radar: RadarItem;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"accordion" | "table">("accordion");
  const [editingPage, setEditingPage] = useState<PicturePage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRadarGroup, setEditingRadarGroup] = useState<DbRadarGroup | null>(null);
  const [editingRadar, setEditingRadar] = useState<DbRadar | null>(null);
  const [isManagingRadars, setIsManagingRadars] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PicturePage | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<DbRadarGroup | null>(null);
  const [radarToDelete, setRadarToDelete] = useState<DbRadar | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<{ id: string; name: string } | null>(null);
  const [editingLink, setEditingLink] = useState<{ id: string; pageId: string; slug: string; name: string; url: string; size: string } | null>(null);
  const router = useRouter();

  const handleDeletePage = async (pageId: string) => {
    try {
      const res = await fetch(config.getApiUrl(`/api/admin/monitoring/picture-pages?id=${pageId}`), {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir página");
      }

      toast({
        type: "success",
        title: "Sucesso",
        description: "Página excluída com sucesso!",
      });
      setPageToDelete(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        title: "Erro",
        description: "Não foi possível excluir a página.",
      });
    }
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    try {
      const slug = editingLink.slug || formatSlug(editingLink.name || "");
      const res = await fetch(config.getApiUrl("/api/admin/monitoring/picture-links"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingLink, slug }),
      });

      if (!res.ok) throw new Error("Erro ao salvar link");

      toast({ type: "success", title: "Sucesso", description: "Link salvo!" });
      setEditingLink(null);

      if (editingPage) {
        const isNew = !editingPage.links.find(l => l.id === editingLink.id);
        const newLinkBase = {
          ...editingLink,
          slug,
          lastUpdate: new Date().toISOString(),
          delay: "-",
          delayMinutes: null,
          status: "undefined" as PictureLinkStatus,
          type: "asset",
        };

        const updatedLinks: PictureLink[] = isNew
          ? [...editingPage.links, newLinkBase]
          : editingPage.links.map(l => l.id === editingLink.id ? { ...l, ...newLinkBase } : l);
        setEditingPage({ ...editingPage, links: updatedLinks });
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Erro", description: "Falha ao salvar link." });
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const res = await fetch(config.getApiUrl(`/api/admin/monitoring/picture-links?id=${linkId}`), {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Erro ao excluir link");

      toast({ type: "success", title: "Sucesso", description: "Link removido!" });
      setLinkToDelete(null);

      if (editingPage) {
        setEditingPage({
          ...editingPage,
          links: editingPage.links.filter(l => l.id !== linkId)
        });
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Erro", description: "Falha ao excluir link." });
    }
  };

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
        const errorData = await res.json();
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

  const handleUpdatePage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPage) return;

    setIsSaving(true);
    try {
      const slug = editingPage.slug || formatSlug(editingPage.name);

      const res = await fetch(config.getApiUrl("/api/admin/monitoring/picture-pages"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPage.id,
          slug,
          name: editingPage.name,
          url: editingPage.url,
          description: editingPage.description,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar dados");
      }

      toast({
        type: "success",
        title: "Sucesso",
        description: "Página atualizada com sucesso!",
      });
      setEditingPage(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        title: "Erro",
        description: "Não foi possível salvar os dados. Verifique a conexão com a API.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const PICTURE_PAGES = picturePages ?? (picturesJson as { pages: PicturePage[] }).pages;

  // Transição: Usar dados da API se existirem, senão usar JSON
  const finalRadarGroups: UIRadarGroup[] = useMemo(() => {
    if (radarGroups && radars && radarGroups.length > 0) {
      return radarGroups.map(g => ({
        ...g,
        radars: radars.filter(r => r.groupId === g.id)
      }));
    }
    return (radarsJson as RadarFile).groups;
  }, [radarGroups, radars]);

  const pictureLinksSummary = useMemo(
    () =>
      PICTURE_PAGES.reduce(
        (acc, page) => {
          page.links.forEach((link) => {
            if (link.status === "offline") {
              acc.offline += 1;
              return;
            }

            if (link.status === "delayed") {
              acc.delayed += 1;
              return;
            }

            acc.ok += 1;
          });

          return acc;
        },
        { ok: 0, delayed: 0, offline: 0 },
      ),
    [PICTURE_PAGES],
  );

  const pictureStatsItems = useMemo<StatItem[]>(
    () => [
      {
        name: "Links ok",
        progress: pictureLinksSummary.ok,
        incidents: 0,
        color: "bg-green-500",
        colorDark: "bg-green-500",
      },
      {
        name: "Links atrasados",
        progress: pictureLinksSummary.delayed,
        incidents: 0,
        color: "bg-red-500",
        colorDark: "bg-red-500",
      },
      {
        name: "Links offline",
        progress: pictureLinksSummary.offline,
        incidents: 0,
        color: "bg-zinc-500",
        colorDark: "bg-zinc-400",
      },
    ],
    [pictureLinksSummary],
  );

  const productSummary = useMemo(() => {
    return productsData.products.reduce(
      (acc, product) => {
        const summaryStatus = getProductSummaryStatus(product.turns);
        acc[summaryStatus] += 1;
        return acc;
      },
      { ran: 0, problem: 0, not_run: 0 },
    );
  }, [productsData.products]);

  const productStatsItems = useMemo<StatItem[]>(
    () => [
      {
        name: "Produtos que rodou",
        progress: productSummary.ran,
        incidents: 0,
        color: "bg-green-500",
        colorDark: "bg-green-500",
      },
      {
        name: "Produtos com problemas",
        progress: productSummary.problem,
        incidents: 0,
        color: "bg-red-500",
        colorDark: "bg-red-500",
      },
      {
        name: "Produtos que nao rodou",
        progress: productSummary.not_run,
        incidents: 0,
        color: "bg-zinc-500",
        colorDark: "bg-zinc-400",
      },
    ],
    [productSummary],
  );

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
        <div className="scrollbar flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-zinc-200 overflow-x-hidden overflow-y-auto dark:divide-zinc-700">
          <section className="p-8">
            <h3 className={SECTION_TITLE_CLASS}>Produtos (modelos)</h3>
            <Stats
              productCount={productsData.products.length}
              primaryLabel="produtos monitorados"
              items={productStatsItems}
              secondaryMetrics={[
                {
                  value: productSummary.ran,
                  label: "produtos que rodou",
                },
                {
                  value: productSummary.problem,
                  label: "produtos com problemas",
                },
                {
                  value: productSummary.not_run,
                  label: "produtos que nao rodou",
                },
              ]}
              progressTitleFormatter={(item: StatItem) =>
                `${item.name}: ${item.progress} produtos monitorados`
              }
              legendTitleFormatter={(item: StatItem) =>
                `${item.name}: ${item.progress} produtos`
              }
            />

            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <ProductMonitoringCards data={productsData} />
            </div>
          </section>

          <section className="p-8">
            <h3 className={SECTION_TITLE_CLASS}>
              Páginas e Figuras da Previsão do tempo
            </h3>
            <Stats
              productCount={PICTURE_PAGES.length}
              primaryLabel="paginas monitoradas"
              items={pictureStatsItems}
              secondaryMetrics={[
                {
                  value: PICTURE_PAGES.reduce((acc, page) => acc + page.links.length, 0),
                  label: "links monitorados",
                },
              ]}
              progressTitleFormatter={(item: StatItem) =>
                `${item.name}: ${item.progress} links monitorados`
              }
              legendTitleFormatter={(item: StatItem) =>
                `${item.name}: ${item.progress} links`
              }
              legendItemNames={["Links ok", "Links atrasados", "Links offline"]}
            />

            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
              <div className="mb-4 flex items-center justify-between">
                <div className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("accordion")}
                    className={clsx(
                      "flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-semibold transition-all duration-200",
                      viewMode === "accordion"
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    <span className="icon-[lucide--layout-list] size-4" />
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={clsx(
                      "flex items-center gap-2 px-6 py-2.5 rounded-lg text-base font-semibold transition-all duration-200",
                      viewMode === "table"
                        ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    )}
                  >
                    <span className="icon-[lucide--table] size-4" />
                    Tabela
                  </button>
                </div>

                <Button
                  style="unstyled"
                  className="inline-flex text-base items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  onClick={() => setEditingPage({
                    id: `page-${Date.now()}`,
                    slug: "",
                    name: "",
                    url: "",
                    description: "",
                    checkMode: "page",
                    status: "ok",
                    delay: "-",
                    delayMinutes: null,
                    delayedLinks: 0,
                    offlineLinks: 0,
                    links: [],
                  })}
                >
                  <span className="icon-[lucide--plus] size-5" />
                  Nova
                </Button>
              </div>

              {viewMode === "accordion" ? (
                <PicturePagesAccordion
                  pages={PICTURE_PAGES}
                  onEdit={(page) => setEditingPage(page)}
                />
              ) : (
                <PicturePagesTable
                  pages={PICTURE_PAGES}
                  onEdit={(page) => setEditingPage(page)}
                />
              )}
            </div>
          </section>
        </div>

        <aside className="scrollbar w-full min-w-0 shrink-0 overflow-x-hidden overflow-y-auto border-t border-zinc-200 lg:min-h-0 lg:w-100 lg:max-w-100 lg:border-l lg:border-t-0 dark:border-zinc-700">
          <div className="p-8">
            <div className="flex flex-col">
              <div className="flex items-start justify-between">
                <h3 className={SECTION_TITLE_CLASS}>Radares</h3>
                <Button
                  style="unstyled"
                  className="-mt-1 p-0 size-10 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors rounded-md"
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

                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="text-lg">💡</span>
                  <span className="ml-1">
                    Clique em um radar para ver descricao, data do log, URL,
                    atraso e status.
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-6">
              {finalRadarGroups.map((group) => (
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

                      return (
                        <button
                          key={radar.id}
                          type="button"
                          title={`${radar.name} - atraso ${radar.delay}`}
                          className={`flex size-12 items-center justify-center rounded-md ${RADAR_BLOCK_COLOR[radar.status as RadarStatus] || RADAR_BLOCK_COLOR.undefined} ${statusUi.squareTextClass} text-sm font-semibold shadow-sm transition-transform duration-150 hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400`}
                          onClick={() =>
                            setSelectedRadar({ groupName: group.name, radar: radar as RadarItem })
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
          </div>
        </aside>
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
                <p className="text-zinc-500 dark:text-zinc-400">Status</p>
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
                  {selectedRadar.radar.delay}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">Descricao</p>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                {selectedRadar.radar.description}
              </p>
            </div>

            <div>
              <p className="text-zinc-500 dark:text-zinc-400">URL do log</p>
              <a
                href={selectedRadar.radar.logUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedRadar.radar.logUrl}
              </a>
            </div>
          </div>
        )}
      </Dialog>

      {/* Gerenciamento de Radares */}
      <Offcanvas
        open={isManagingRadars}
        onClose={() => setIsManagingRadars(false)}
        title="Gerenciar Radares"
        width="lg"
      >
        <div className="space-y-8 p-1">
          {/* Sessão Grupos */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Grupos de Radares</h4>
              <Button onClick={() => setEditingRadarGroup({ id: `group-${Date.now()}`, slug: "", name: "", sortOrder: 0 })}>
                Novo Grupo
              </Button>
            </div>
            <div className="space-y-2">
              {finalRadarGroups.map(group => (
                <div key={group.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <span className="font-medium">{group.name}</span>
                  <div className="flex gap-1">
                    <Button style="unstyled" className="p-2" onClick={() => {
                      const groupTyped = group as DbRadarGroup;
                      setEditingRadarGroup({
                        id: groupTyped.id,
                        slug: groupTyped.slug || "",
                        name: groupTyped.name,
                        sortOrder: groupTyped.sortOrder || 0
                      });
                    }}>
                      <span className="icon-[lucide--pencil] size-4" />
                    </Button>
                    <Button style="unstyled" className="py-1 px-2 text-sm h-auto flex items-center" onClick={() => setEditingRadar({ id: `radar-${Date.now()}`, groupId: group.id, slug: "", name: "", description: "", webhookUrl: "", logUrl: "", status: "ok", active: true, delay: null, delayMinutes: null, logDate: null })}>
                      <span className="icon-[lucide--plus] size-4" />
                      Novo radar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Listagem de Radares por Grupo */}
          <div className="space-y-6">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">Webhooks e Configurações</h4>
            {finalRadarGroups.map(group => (
              <div key={`manage-${group.id}`} className="space-y-3">
                <h5 className="text-base font-bold uppercase text-zinc-500">{group.name}</h5>
                <div className="grid grid-cols-1 gap-3">
                  {group.radars.map((radar) => {
                    const radarTyped = radar as UIRadarItem;
                    const webhookUrl = "webhookUrl" in radarTyped ? radarTyped.webhookUrl : "";

                    return (
                      <div key={radarTyped.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{radarTyped.name}</p>
                          <p className="text-xs text-zinc-500 truncate">{webhookUrl || "Sem webhook configurado"}</p>
                        </div>
                        <Button style="unstyled" className="p-2" onClick={() => setEditingRadar(radarTyped as DbRadar)}>
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

      {/* Edição de Grupo */}
      <Offcanvas
        open={!!editingRadarGroup}
        onClose={() => setEditingRadarGroup(null)}
        title={editingRadarGroup?.name ? "Editar Grupo" : "Novo Grupo"}
        width="md"
        zIndex={80}
        footerActions={
          <div className="flex justify-between items-center w-full">
            <div>
              {!editingRadarGroup?.id?.includes("group-") && (
                <Button
                  style="bordered"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={() => editingRadarGroup && setGroupToDelete(editingRadarGroup)}
                >
                  <span className="icon-[lucide--trash-2] size-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button style="bordered" onClick={() => setEditingRadarGroup(null)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!editingRadarGroup) return;
                const slug = editingRadarGroup.slug || formatSlug(editingRadarGroup.name);
                const res = await fetch(config.getApiUrl("/api/admin/monitoring/radar-groups"), {
                  method: editingRadarGroup?.id?.includes("group-") ? "POST" : "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...editingRadarGroup, slug }),
                });
                if (res.ok) {
                  toast({ type: "success", title: "Sucesso", description: "Grupo salvo!" });
                  setEditingRadarGroup(null);
                  router.refresh();
                }
              }}>Salvar</Button>
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
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                type="text"
                value={editingRadarGroup.slug}
                setValue={(v) => setEditingRadarGroup({ ...editingRadarGroup, slug: v })}
                placeholder="ex: grupo-sul"
                required
              />
            </div>
          </div>
        )}
      </Offcanvas>

      {/* Edição de Radar */}
      <Offcanvas
        open={!!editingRadar}
        onClose={() => setEditingRadar(null)}
        title="Configurar Radar"
        width="md"
        zIndex={80}
        footerActions={
          <div className="flex justify-between items-center w-full">
            <div>
              {!editingRadar?.id?.includes("radar-") && (
                <Button
                  style="bordered"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={() => editingRadar && setRadarToDelete(editingRadar)}
                >
                  <span className="icon-[lucide--trash-2] size-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button style="bordered" onClick={() => setEditingRadar(null)}>Cancelar</Button>
              <Button onClick={async () => {
                if (!editingRadar) return;
                const slug = editingRadar.slug || formatSlug(editingRadar.name);
                const res = await fetch(config.getApiUrl("/api/admin/monitoring/radars"), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...editingRadar, slug }),
                });
                if (res.ok) {
                  toast({ type: "success", title: "Sucesso", description: "Radar configurado!" });
                  setEditingRadar(null);
                  router.refresh();
                }
              }}>Salvar Configurações</Button>
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
                className="w-full h-11 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={editingRadar.groupId}
                onChange={(e) => setEditingRadar({ ...editingRadar, groupId: e.target.value })}
              >
                {finalRadarGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                type="text"
                value={editingRadar.slug}
                setValue={(v) => setEditingRadar({ ...editingRadar, slug: v })}
                placeholder="ex: radar-foz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL (Gerenciamento)</Label>
              <Input
                type="text"
                value={editingRadar.webhookUrl || ""}
                setValue={(v) => setEditingRadar({ ...editingRadar, webhookUrl: v })}
                placeholder="https://hooks.example.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>URL de Log (Botão)</Label>
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

      <Offcanvas
        open={!!editingPage}
        onClose={() => setEditingPage(null)}
        title="Editar Página de Monitoramento"
        footerActions={
          <div className="flex w-full justify-between items-center">
            <div>
              {!editingPage?.id?.includes("page-") && (
                <Button
                  style="bordered"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={() => editingPage && setPageToDelete(editingPage)}
                >
                  <span className="icon-[lucide--trash-2] size-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button style="bordered" onClick={() => setEditingPage(null)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" form="edit-monitoring-page-form" loading={isSaving}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        }
      >
        {editingPage && (
          <form id="edit-monitoring-page-form" onSubmit={handleUpdatePage} className="space-y-6">
            <div className="space-y-2">
              <Label>Nome da Página</Label>
              <Input
                type="text"
                value={editingPage.name}
                setValue={(v) => setEditingPage({ ...editingPage, name: v })}
                placeholder="Ex: Previsão do Tempo Inmet"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                type="text"
                value={editingPage.slug}
                setValue={(v) => setEditingPage({ ...editingPage, slug: v })}
                placeholder="exemplo-slug"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>URL da Página</Label>
              <Input
                type="text"
                value={editingPage.url}
                setValue={(v) => setEditingPage({ ...editingPage, url: v })}
                placeholder="https://..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editingPage.description || ""}
                onChange={(e) => setEditingPage({ ...editingPage, description: e.target.value })}
                placeholder="Informações sobre os dados desta página..."
                rows={4}
              />
            </div>

            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold uppercase text-zinc-500">Links da Página</h4>
                <Button
                  style="bordered"
                  className="h-9 px-3 text-xs"
                  onClick={() => setEditingLink({ id: `link-${Date.now()}`, pageId: editingPage.id, slug: "", name: "", url: "", size: "" })}
                >
                  <span className="icon-[lucide--plus] size-3 mr-1" />
                  Novo Link
                </Button>
              </div>

              <div className="space-y-3">
                {editingPage.links.length > 0 ? (
                  editingPage.links.map(link => (
                    <div key={link.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50/50 dark:bg-zinc-800/50 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600">
                      <div className="min-w-0 pr-4">
                        <p className="font-medium text-sm truncate text-zinc-900 dark:text-zinc-100">{link.name || link.slug}</p>
                        <p className="text-xs text-zinc-500 truncate">{link.url}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button style="unstyled" className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors" onClick={() => setEditingLink({
                          id: link.id,
                          pageId: editingPage.id,
                          slug: link.slug,
                          name: link.name,
                          url: link.url,
                          size: link.size || ""
                        })}>
                          <span className="icon-[lucide--pencil] size-4 text-zinc-500" />
                        </Button>
                        <Button style="unstyled" className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors group" onClick={() => setLinkToDelete({ id: link.id, name: link.name || link.slug })}>
                          <span className="icon-[lucide--trash-2] size-4 text-zinc-400 group-hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-500">Nenhum link cadastrado ainda.</p>
                  </div>
                )}
              </div>
            </div>
          </form>
        )}
      </Offcanvas>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={!!pageToDelete}
        onClose={() => setPageToDelete(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="p-6">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Tem certeza que deseja excluir a página <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{pageToDelete?.name}&quot;</span>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setPageToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={() => pageToDelete && handleDeletePage(pageToDelete.id)}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Offcanvas de Link */}
      <Offcanvas
        open={!!editingLink}
        onClose={() => setEditingLink(null)}
        title={editingLink?.id.includes("link-") ? "Novo Link" : "Editar Link"}
        width="md"
        zIndex={100}
        footerActions={
          <div className="flex w-full justify-end gap-3">
            <Button style="bordered" onClick={() => setEditingLink(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-link-form">
              Salvar Link
            </Button>
          </div>
        }
      >
        {editingLink && (
          <form id="edit-link-form" onSubmit={handleSaveLink} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Link</Label>
              <Input
                type="text"
                value={editingLink.name || ""}
                setValue={(v) => setEditingLink({ ...editingLink, name: v })}
                placeholder="Ex: Curitiba"
              />
            </div>
            <div className="space-y-2">
              <Label>URL da Imagem</Label>
              <Input
                type="text"
                value={editingLink.url}
                setValue={(v) => setEditingLink({ ...editingLink, url: v })}
                placeholder="https://..."
                required
              />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label>Slug</Label>
                <Input
                  type="text"
                  value={editingLink.slug}
                  setValue={(v) => setEditingLink({ ...editingLink, slug: v })}
                  placeholder="curitiba"
                  required
                />
              </div>
              <div className="w-full md:w-32 space-y-2">
                <Label>Tamanho</Label>
                <Input
                  type="text"
                  value={editingLink.size || ""}
                  setValue={(v) => setEditingLink({ ...editingLink, size: v })}
                  placeholder="100x100"
                />
              </div>
            </div>
          </form>
        )}
      </Offcanvas>

      {/* Dialog de Confirmação de Exclusão de Grupo */}
      <Dialog
        open={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        title="Confirmar Exclusão de Grupo"
        size="sm"
      >
        <div className="p-6">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Tem certeza que deseja excluir o grupo <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{groupToDelete?.name}&quot;</span>?
            Esta ação removerá o grupo da organização. O grupo deve estar vazio.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setGroupToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={() => groupToDelete && handleDeleteRadarGroup(groupToDelete.id)}
            >
              Excluir Grupo
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão de Radar */}
      <Dialog
        open={!!radarToDelete}
        onClose={() => setRadarToDelete(null)}
        title="Confirmar Exclusão de Radar"
        size="sm"
      >
        <div className="p-6">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Tem certeza que deseja excluir o radar <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{radarToDelete?.name}&quot;</span>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setRadarToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={() => radarToDelete && handleDeleteRadar(radarToDelete.id)}
            >
              Excluir Radar
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão de Link */}
      <Dialog
        open={!!linkToDelete}
        onClose={() => setLinkToDelete(null)}
        title="Confirmar Exclusão de Link"
        size="sm"
      >
        <div className="p-6">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Tem certeza que deseja excluir o link <span className="font-semibold text-zinc-900 dark:text-zinc-100">&quot;{linkToDelete?.name}&quot;</span>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button style="bordered" onClick={() => setLinkToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={() => linkToDelete && handleDeleteLink(linkToDelete.id)}
            >
              Excluir Link
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function formatDateTimeBR(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
