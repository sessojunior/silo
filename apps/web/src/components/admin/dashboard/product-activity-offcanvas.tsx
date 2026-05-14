import { useEffect, useState, useCallback, useMemo } from "react";
import Offcanvas from "@/components/ui/offcanvas";
import Label from "@/components/ui/label";
import Select, { SelectOption } from "@/components/ui/select";
import Button from "@/components/ui/button";
import MarkdownEditor from "@/components/ui/markdown-editor";
import { toast } from "@silo/engine/format/toast";
import { formatDateBR } from "@silo/engine/date";
import { NO_INCIDENTS_CATEGORY_ID, isRealIncident } from "@silo/engine/constants";
import {
  STATUS_OPTIONS,
  INCIDENT_STATUS,
  ProductStatus,
} from "@silo/engine/domain/product-status";
import IncidentManagementOffcanvas from "./incident-management-offcanvas";
import ProductActivityPendingEmailDialog from "./product-activity-pending-email-dialog";
import { config } from "@/lib/config";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  date: string;
  turn: number;
  existingId?: string | null;
  initialStatus?: string;
  initialDescription?: string | null;
  initialIntervention?: string | null;
  initialCategoryId?: string | null;
  onSaved?: () => void;
  onAddSaveLog?: (
    step: string,
    details: unknown,
    success?: boolean,
    error?: string,
  ) => void;
  onViewHistory?: () => void;
}

type ActivityAvailability = {
  requestedDate: string;
  requestedTurn: number;
  allowedTurns: string[];
  fits: boolean;
  reason: "available" | "conflict" | "turn_not_allowed" | "product_unavailable";
  conflictCount: number;
  suggestedSlots: Array<{ date: string; turn: number }>;
};

type ActivityAvailabilityBanner = {
  className: string;
  title: string;
  body?: string | null;
};

export default function ProductActivityOffcanvas({
  open,
  onClose,
  productId,
  productName,
  date,
  turn,
  existingId = null,
  initialStatus = "completed",
  initialDescription = "",
  initialIntervention = "",
  initialCategoryId = null,
  onSaved,
  onAddSaveLog,
  onViewHistory,
}: Props) {
  
  const [status, setStatus] = useState<string>(initialStatus);
  const [description, setDescription] = useState<string>(
    initialDescription || "",
  );
  const [intervention, setIntervention] = useState<string>(
    initialIntervention || "",
  );
  const [incidentId, setIncidentId] = useState<string | null>(
    initialCategoryId || "",
  );
  const [incidents, setIncidents] = useState<SelectOption[]>([]);
  const [allIncidents, setAllIncidents] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<ActivityAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [incidentManagementOpen, setIncidentManagementOpen] = useState(false);
  const [pendingEmailOpen, setPendingEmailOpen] = useState(false);
  const uploadConfig = useMemo(
    () => ({
      enabled: true,
      showButton: true,
      uploadEndpoint: "incidentImageUploader" as const,
      listEndpoint: "/api/admin/incidents/images",
      deleteEndpoint: "/api/admin/incidents/images",
      directory: "/uploads/incidents",
      title: "Inserir imagem do incidente",
    }),
    [],
  );

  useEffect(() => {
    if (open) {
      // reset fields when reopened
      setStatus(initialStatus);
      setDescription(initialDescription || "");
      setIntervention(initialIntervention || "");
      setIncidentId(
        initialCategoryId === NO_INCIDENTS_CATEGORY_ID
          ? ""
          : initialCategoryId || "",
      );
    }
  }, [
    open,
    initialStatus,
    initialDescription,
    initialIntervention,
    initialCategoryId,
  ]);

  const loadIncidents = useCallback(async () => {
    try {
      const response = await fetch(config.getApiUrl("/api/admin/incidents"), {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        throw new Error("Usuário não autenticado");
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        const incidentOptions = [
          { label: "Não houve incidentes", value: NO_INCIDENTS_CATEGORY_ID },
          ...data.data.map((incident: { name: string; id: string }) => ({
            label: incident.name,
            value: incident.id,
          })),
        ];
        setAllIncidents(incidentOptions);
        updateIncidentsForStatus(incidentOptions, status);
      } else {
        const defaultOptions = [
          { label: "Não houve incidentes", value: NO_INCIDENTS_CATEGORY_ID },
        ];
        setAllIncidents(defaultOptions);
        updateIncidentsForStatus(defaultOptions, status);
      }
    } catch (error) {
      console.error(
        "? [COMPONENT_PRODUCT_ACTIVITY] Erro ao carregar incidentes:",
        { error },
      );
      // Manter opção padrão
      const defaultOptions = [
        { label: "Não houve incidentes", value: NO_INCIDENTS_CATEGORY_ID },
      ];
      setAllIncidents(defaultOptions);
      updateIncidentsForStatus(defaultOptions, status);
    }
  }, [status]);

  const updateIncidentsForStatus = (
    allOptions: SelectOption[],
    currentStatus: string,
  ) => {
    const requireIncidentForStatus = INCIDENT_STATUS.has(
      currentStatus as ProductStatus,
    );

    if (!requireIncidentForStatus) {
      const optionsWithEmpty = [
        { label: "Nenhum incidente", value: "" },
        ...allOptions.filter(
          (option) => option.value !== NO_INCIDENTS_CATEGORY_ID,
        ),
      ];
      setIncidents(optionsWithEmpty);
      return;
    }

    setIncidents(
      allOptions.filter((option) => option.value !== NO_INCIDENTS_CATEGORY_ID),
    );
  };

  // Carregar incidentes quando o offcanvas abre
  useEffect(() => {
    if (open) {
      loadIncidents();
    }
  }, [open, loadIncidents]);

  // Atualizar opções de incidentes quando o status mudar
  useEffect(() => {
    if (allIncidents.length > 0) {
      updateIncidentsForStatus(allIncidents, status);

      if (incidentId === NO_INCIDENTS_CATEGORY_ID) setIncidentId("");
    }
  }, [status, allIncidents, incidentId]);

  useEffect(() => {
    if (!isRealIncident(incidentId)) {
      setDescription("");
      setIntervention("");
    }
  }, [incidentId]);

  useEffect(() => {
    if (!open) setPendingEmailOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setAvailability(null);
      setAvailabilityLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadAvailability = async (): Promise<void> => {
      setAvailabilityLoading(true);

      try {
        const searchParams = new URLSearchParams({
          productId,
          date,
          turn: String(turn),
        });

        if (existingId) {
          searchParams.set("activityId", existingId);
        }

        const response = await fetch(
          config.getApiUrl(
            `/api/admin/products/activities/availability?${searchParams.toString()}`,
          ),
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as {
          success: boolean;
          data?: ActivityAvailability;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Erro ao verificar disponibilidade.");
        }

        setAvailability(payload.data);
      } catch {
        if (controller.signal.aborted) return;
        setAvailability(null);
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => controller.abort();
  }, [open, productId, date, turn, existingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    onAddSaveLog?.("Iniciando salvamento", {
      productId,
      date,
      turn,
      status,
      description,
      intervention,
      incidentId,
      existingId,
    });

    // validate
    if (INCIDENT_STATUS.has(status as ProductStatus) && !incidentId) {
      toast({ type: "error", title: "Selecione o incidente" });
      return;
    }

    // Validação: se há incidente real selecionado, descrição é obrigatória
    if (hasRealIncident && !description.trim()) {
      toast({
        type: "error",
        title:
          "Descrição de incidentes é obrigatória quando um incidente é selecionado",
      });
      return;
    }

    setLoading(true);
    try {
      const payload: {
        productId: string;
        date: string;
        turn: number;
        status: string;
        description: string;
        intervention: string;
        problemCategoryId: string | null;
        id?: string;
      } = {
        productId,
        date,
        turn,
        status,
        description,
        intervention,
        problemCategoryId:
          incidentId && incidentId !== NO_INCIDENTS_CATEGORY_ID
            ? incidentId
            : null,
      };
      const url = config.getApiUrl("/api/admin/products/activities");
      let method: "POST" | "PUT" = "POST";
      if (existingId) {
        method = "PUT";
        payload.id = existingId;
      }

      onAddSaveLog?.("Enviando requisição", {
        method,
        url,
        payload,
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      onAddSaveLog?.("Resposta da API", {
        status: res.status,
        ok: res.ok,
        json,
      });

      if (res.ok && json.success) {
        const action = json.action ?? (existingId ? "updated" : "created");
        onAddSaveLog?.(
          "Salvamento bem-sucedido",
          {
            action,
          },
          true,
        );
        toast({
          type: "success",
          title:
            action === "updated"
              ? "Acontecimento atualizado"
              : "Acontecimento criado",
        });
        onClose();
        onSaved?.();
      } else {
        onAddSaveLog?.(
          "Erro no salvamento",
          {
            message: json.message,
          },
          false,
          json.message,
        );
        toast({ type: "error", title: json.message || "Erro" });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      onAddSaveLog?.(
        "Erro na requisição",
        {
          error: errorMessage,
        },
        false,
        errorMessage,
      );
      toast({ type: "error", title: "Erro na requisição" });
    } finally {
      setLoading(false);
    }
  };

  const requireIncident = INCIDENT_STATUS.has(status as ProductStatus);
  const hasRealIncident = isRealIncident(incidentId);
  const selectedIncidentName = useMemo(() => {
    if (!hasRealIncident) return null;

    return (
      allIncidents.find((incident) => incident.value === incidentId)?.label ||
      incidents.find((incident) => incident.value === incidentId)?.label ||
      null
    );
  }, [allIncidents, hasRealIncident, incidentId, incidents]);
  const canSendPendingEmail =
    description.trim().length > 0 || intervention.trim().length > 0;

  const availabilityBanner = useMemo<ActivityAvailabilityBanner | null>(() => {
    if (availabilityLoading) {
      return {
        className:
          "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
        title: "Verificando disponibilidade do turno...",
      };
    }

    if (!availability) return null;

    if (availability.fits) {
      return {
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-950/20 dark:text-emerald-100",
        title: "Turno disponível para registro.",
      };
    }

    const reasonText =
      availability.reason === "product_unavailable"
        ? "Este produto está desativado e não aceita novos registros."
        : availability.reason === "turn_not_allowed"
        ? `Este turno não está configurado para o produto. Turnos habilitados: ${availability.allowedTurns.map((allowedTurn) => `${allowedTurn}h`).join(", ")}.`
        : `${availability.conflictCount === 1 ? "Existe 1 registro" : `Existem ${availability.conflictCount} registros`} nesse turno.`;

    const suggestedText =
      availability.reason === "product_unavailable"
        ? "Ative o produto para liberar registros neste turno."
        : availability.suggestedSlots.length > 0
        ? `Sugestões próximas: ${availability.suggestedSlots.map((slot) => `${formatDateBR(slot.date)} ${slot.turn}h`).join(" · ")}.`
        : "Nenhuma sugestão disponível no intervalo próximo.";

    return {
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-100",
      title: reasonText,
      body: suggestedText,
    };
  }, [availability, availabilityLoading]);

  const handleOpenPendingEmail = () => {
    if (!canSendPendingEmail) {
      toast({
        type: "error",
        title: "Preencha incidente ou intervenção para enviar pendências",
      });
      return;
    }

    setPendingEmailOpen(true);
  };

  return (
    <Offcanvas
      open={open}
      onClose={onClose}
      title="Editar acontecimentos no turno"
      side="right"
      width="xl"
      zIndex={80}
      footerActions={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            <Button
              icon="icon-[lucide--mail-plus]"
              style="bordered"
              type="button"
              onClick={handleOpenPendingEmail}
              disabled={loading}
              className="shrink-0"
              title="Enviar pendências"
            >
              Enviar pendências
            </Button>
          </div>
          <div className="flex gap-2">
            <Button style="bordered" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="product-activity-form"
              disabled={loading}
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Bloco de contexto mais elegante */}
        <div className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-700/50 dark:bg-blue-950/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300">
            <span className="icon-[lucide--calendar-clock] size-6"></span>
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {productName}
            </span>
            <div className="flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
              <span className="flex items-center gap-1">
                <span className="icon-[lucide--calendar-days] size-4"></span>
                {formatDateBR(date)}
              </span>
              <span className="flex items-center gap-1">
                <span className="icon-[lucide--clock] size-4"></span>
                {turn}h
              </span>
            </div>
          </div>
          {/* Botão de histórico */}
          {onViewHistory && (
            <Button
              icon="icon-[lucide--history]"
              style="bordered"
              onClick={onViewHistory}
              className="px-3 py-2"
              title="Ver histórico de status"
            >
              Histórico
            </Button>
          )}
        </div>

        {availabilityBanner ? (
          <div className={`rounded-lg border p-4 text-sm ${availabilityBanner.className}`}>
            <div className="font-semibold">{availabilityBanner.title}</div>
            {availabilityBanner.body ? (
              <div className="mt-1 leading-relaxed">{availabilityBanner.body}</div>
            ) : null}
          </div>
        ) : null}

        <form
          id="product-activity-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* Status e Incidentes na mesma linha */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label required>Status</Label>
              <Select
                name="status"
                options={STATUS_OPTIONS}
                selected={status}
                onChange={setStatus}
                placeholder="Selecione o status"
                required
              />
            </div>
            <div className="flex-1">
              <Label required={requireIncident}>Incidentes</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="incident"
                  options={incidents}
                  selected={incidentId ?? undefined}
                  onChange={(value) => {
                    setIncidentId(value);
                  }}
                  placeholder="Selecione o incidente"
                  required={requireIncident}
                  clearable={!requireIncident}
                  onClear={() => setIncidentId(null)}
                />
                <Button
                  icon="icon-[lucide--settings]"
                  type="button"
                  style="bordered"
                  onClick={() => setIncidentManagementOpen(true)}
                  className="px-3 py-3 h-12"
                  title="Gerenciar incidentes"
                ></Button>
              </div>
            </div>
          </div>
          {hasRealIncident && (
            <div className="space-y-4">
              <Label required>Descrição de incidentes</Label>

              {/* Dicas de formatação Markdown */}
              <div className="mt-2">
                <MarkdownEditor
                  value={description}
                  onChange={(value) => setDescription(value || "")}
                  className="h-full w-full"
                  uploadConfig={uploadConfig}
                />
              </div>

              <div>
                <Label>Descrição da intervenção realizada</Label>
                <div className="mt-2">
                  <MarkdownEditor
                    value={intervention}
                    onChange={(value) => setIntervention(value || "")}
                    className="h-full w-full"
                    uploadConfig={uploadConfig}
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Offcanvas de gerenciamento de incidentes */}
        <IncidentManagementOffcanvas
          open={incidentManagementOpen}
          onClose={() => setIncidentManagementOpen(false)}
          onIncidentUpdated={() => {
            loadIncidents();
          }}
        />
        <ProductActivityPendingEmailDialog
          open={pendingEmailOpen}
          onClose={() => setPendingEmailOpen(false)}
          productId={productId}
          productName={productName}
          date={date}
          turn={turn}
          status={status}
          incidentName={selectedIncidentName}
          description={description}
          intervention={intervention}
        />
      </div>
    </Offcanvas>
  );
}
