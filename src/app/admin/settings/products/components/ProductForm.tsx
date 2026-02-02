import React, { useState } from "react";
import Switch from "@/components/ui/Switch";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface ProductFormProps {
  initialData?: {
    id?: string;
    name: string;
    slug: string;
    available: boolean;
    turns: string[];
    priority: "low" | "normal" | "high" | "urgent";
    description: string | null;
  };
  onSubmit: (data: {
    id?: string;
    name: string;
    slug: string;
    available: boolean;
    turns: string[];
    priority: "low" | "normal" | "high" | "urgent";
    description: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

export default function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  loading,
}: ProductFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [available, setAvailable] = useState(initialData?.available ?? true);
  const [turns, setTurns] = useState<string[]>(
    initialData?.turns || ["0", "6", "12", "18"],
  );
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >(initialData?.priority ?? "normal");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("O nome deve possuir ao menos dois caracteres.");
      return;
    }
    setError(null);
    try {
      const trimmedDescription = description.trim();
      await onSubmit({
        id: initialData?.id,
        name: name.trim(),
        slug: slug.trim(),
        available,
        turns,
        priority,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
      });
      toast({
        type: "success",
        title: initialData ? "Produto atualizado" : "Produto criado",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao salvar produto.";
      toast({ type: "error", title: "Erro", description: errorMessage });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div>
        <label
          htmlFor="product-name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1"
        >
          Nome
        </label>
        <input
          id="product-name"
          type="text"
          className="block w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
          disabled={loading}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <div>
        <label
          htmlFor="product-slug"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1"
        >
          Slug
        </label>
        <input
          id="product-slug"
          type="text"
          className="block w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          minLength={2}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label
          htmlFor="product-priority"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1"
        >
          Prioridade
        </label>
        <Select
          id="product-priority"
          name="priority"
          selected={priority}
          onChange={(value) =>
            setPriority(value as "low" | "normal" | "high" | "urgent")
          }
          options={[
            { value: "low", label: "Baixa" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "Alta" },
            { value: "urgent", label: "Urgente" },
          ]}
          placeholder="Selecionar prioridade"
        />
      </div>
      <div>
        <label
          htmlFor="product-description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1"
        >
          Descrição
        </label>
        <textarea
          id="product-description"
          className="block w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Turnos de Execução
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Selecione os horários em que este produto será executado no sistema
        </p>
        <div className="space-y-3">
          {["0", "6", "12", "18"].map((turn) => (
            <div
              key={turn}
              className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
            >
              <div className="flex flex-1 items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {turn}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Turno {turn.padStart(2, "0")}:00
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {parseInt(turn) === 0
                      ? "Meia-noite"
                      : parseInt(turn) === 6
                        ? "Madrugada"
                        : parseInt(turn) === 12
                          ? "Meio-dia"
                          : "Tarde"}
                  </p>
                </div>
              </div>
              <Switch
                id={`turn-${turn}`}
                name={`turn-${turn}`}
                checked={turns.includes(turn)}
                onChange={(checked) => {
                  if (checked) {
                    setTurns([...turns, turn]);
                  } else {
                    setTurns(turns.filter((t) => t !== turn));
                  }
                }}
                disabled={loading}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
        <div className="flex items-center justify-between p-4 rounded bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex flex-1 items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30">
              <span className="icon-[lucide--eye] size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Visibilidade em Visão geral
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {available
                  ? "Produto visível no dashboard do sistema"
                  : "Produto oculto na visão geral do sistema"}
              </p>
            </div>
          </div>
          <Switch
            id="product-available"
            name="available"
            checked={available}
            onChange={setAvailable}
            disabled={loading}
            size="md"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          style="bordered"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="icon-[lucide--loader-2] size-4 animate-spin mr-2" />
              {initialData ? "Salvando..." : "Criando..."}
            </>
          ) : (
            <>{initialData ? "Salvar" : "Criar"}</>
          )}
        </Button>
      </div>
    </form>
  );
}
