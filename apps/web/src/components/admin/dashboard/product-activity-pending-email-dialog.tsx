"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import Label from "@/components/ui/label";
import MultiSelect, { type MultiSelectOption } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { config } from "@/lib/config";
import { formatDateBR } from "@silo/engine/date";
import { buildProductActivityPendingEmailBody } from "@silo/engine/domain/product-activity-pending-email";
import { toast } from "@silo/engine/format/toast";
import { useCurrentUser } from "@/hooks/use-current-user";

interface RecipientUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  date: string;
  turn: number;
  status: string;
  incidentName?: string | null;
  description: string;
  intervention: string;
}

const PENDING_EMAIL_ENDPOINT = "/api/admin/products/activities/pending-email";

export default function ProductActivityPendingEmailDialog({
  open,
  onClose,
  productId,
  productName,
  date,
  turn,
  status,
  incidentName,
  description,
  intervention,
}: Props) {
  const [recipientOptions, setRecipientOptions] = useState<MultiSelectOption[]>(
    [],
  );
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    [],
  );
  const [message, setMessage] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useCurrentUser();

  const currentUserLabel = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.name && currentUser.email) {
      return `${currentUser.name} (${currentUser.email})`;
    }

    return currentUser.name || currentUser.email || null;
  }, [currentUser]);

  const initialMessage = useMemo(
    () =>
      buildProductActivityPendingEmailBody({
        productName,
        date,
        userName: currentUserLabel,
        turn,
        status,
        incidentName,
        description,
        intervention,
      }),
    [
      productName,
      date,
      currentUserLabel,
      turn,
      status,
      incidentName,
      description,
      intervention,
    ],
  );

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const response = await fetch(config.getApiUrl(PENDING_EMAIL_ENDPOINT), {
        credentials: "include",
      });
      const payload = (await response.json()) as ApiResponse<{
        items?: RecipientUser[];
      }>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || payload.error || "Erro ao carregar destinatários.",
        );
      }

      const users = Array.isArray(payload.data?.items)
        ? payload.data.items
        : [];
      setRecipientOptions(
        users.map((user) => ({
          label: `${user.name} - ${user.email}`,
          value: user.id,
          image: user.image,
        })),
      );
    } catch (loadError) {
      const messageText =
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar destinatários.";
      setRecipientOptions([]);
      setError(messageText);
      toast({ type: "error", title: messageText });
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setMessage(initialMessage);
    setSelectedRecipientIds([]);
    setError(null);
    loadRecipients();
  }, [open, initialMessage, loadRecipients]);

  const handleClose = () => {
    if (!sending) onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (selectedRecipientIds.length === 0) {
      setError("Selecione pelo menos um destinatário.");
      return;
    }

    if (!message.trim()) {
      setError("Mensagem é obrigatória.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(config.getApiUrl(PENDING_EMAIL_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          date,
          turn,
          status,
          incidentName,
          recipientUserIds: selectedRecipientIds,
          message,
        }),
      });
      const payload = (await response.json()) as ApiResponse<{ sent?: number }>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || payload.error || "Erro ao enviar pendências.",
        );
      }

      toast({
        type: "success",
        title: payload.message || "Pendências enviadas com sucesso.",
      });
      onClose();
    } catch (submitError) {
      const messageText =
        submitError instanceof Error
          ? submitError.message
          : "Erro ao enviar pendências.";
      setError(messageText);
      toast({ type: "error", title: messageText });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <span className="icon-[lucide--mail-plus] size-5 text-blue-600" />
          Enviar pendências por e-mail
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900 dark:border-blue-700/50 dark:bg-blue-950/20 dark:text-blue-100">
            <div className="font-semibold">{productName}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-blue-700 dark:text-blue-300">
              <span>{formatDateBR(date)}</span>
              <span>{turn}h</span>
              {incidentName ? <span>{incidentName}</span> : null}
            </div>
          </div>

          <div>
            <Label htmlFor="pending-email-recipients" required>
              Destinatários
            </Label>
            {loadingRecipients ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                Carregando usuários...
              </div>
            ) : (
              <MultiSelect
                id="pending-email-recipients"
                name="pendingEmailRecipients"
                selected={selectedRecipientIds}
                onChange={(values) => {
                  setSelectedRecipientIds(values);
                  setError(null);
                }}
                options={recipientOptions}
                placeholder="Selecione os usuários"
                required
                isInvalid={selectedRecipientIds.length === 0 && !!error}
                invalidMessage="Selecione pelo menos um destinatário"
              />
            )}
            {!loadingRecipients && recipientOptions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum usuário ativo disponível.
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="pending-email-message" required>
              Mensagem
            </Label>
            <Textarea
              id="pending-email-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError(null);
              }}
              rows={14}
              disabled={sending}
              className="mt-2 min-h-70 font-mono text-sm"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700">
          <Button
            type="button"
            style="bordered"
            onClick={handleClose}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={sending}
            disabled={
              loadingRecipients || recipientOptions.length === 0 || sending
            }
          >
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
