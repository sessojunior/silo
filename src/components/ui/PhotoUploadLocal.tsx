"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { config } from "@/lib/config";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/lib/toast";
import { normalizeUploadsSrc } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import type { ApiResponse } from "@/lib/api-response";

/**
 * Componente de upload de foto de perfil usando servidor local
 */

type PhotoUploadLocalProps = {
  image?: string;
  className?: string;
};

export default function PhotoUploadLocal({
  image,
  className,
}: PhotoUploadLocalProps) {
  const { updateUser } = useUser();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const [invalidMessage, setInvalidMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const parseApiResponse = <T,>(payload: unknown): ApiResponse<T> | null => {
    if (!isRecord(payload)) return null;
    if (typeof payload.success !== "boolean") return null;
    return payload as ApiResponse<T>;
  };

  const toDisplayUploadsSrc = (value: string): string => {
    const normalized = normalizeUploadsSrc(value);
    if (normalized.startsWith("blob:")) return normalized;
    if (normalized.startsWith("http://") || normalized.startsWith("https://"))
      return normalized;
    if (
      normalized.startsWith("/uploads/") &&
      !normalized.startsWith(`${config.publicBasePath}/uploads/`)
    ) {
      return config.getPublicPath(normalized);
    }
    return normalized;
  };

  // Carrega imagem inicial (caso exista)
  useEffect(() => {
    if (image) {
      const normalized = normalizeUploadsSrc(image);
      const displaySrc =
        normalized.startsWith("/uploads/") &&
        !normalized.startsWith(`${config.publicBasePath}/uploads/`)
          ? config.getPublicPath(normalized)
          : normalized;
      setPreviewUrl(displaySrc);
    }
  }, [image]);

  const extractErrorMessage = (data: unknown): string | null => {
    if (!data || typeof data !== "object") return null;
    const message = (data as Record<string, unknown>).message;
    return typeof message === "string" && message.trim().length > 0
      ? message
      : null;
  };

  const getResponseErrorMessage = async (
    response: Response,
  ): Promise<string | null> => {
    try {
      const data: unknown = await response.json();
      return extractErrorMessage(data);
    } catch {
      return null;
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setIsInvalid(true);
      setInvalidMessage("Tipo de arquivo não permitido. Use JPG, PNG ou WebP.");
      toast({ type: "error", title: "Tipo de arquivo não permitido" });
      return;
    }

    // Validar tamanho (4MB)
    if (file.size > 4 * 1024 * 1024) {
      setIsInvalid(true);
      setInvalidMessage("Arquivo muito grande. Máximo 4MB.");
      toast({ type: "error", title: "Arquivo muito grande" });
      return;
    }

    setIsUploading(true);
    setIsInvalid(false);

    try {
      const formData = new FormData();
      formData.append("fileToUpload", file);

      const response = await fetch(config.getApiUrl("/api/user-profile-image"), {
        method: "POST",
        body: formData,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = extractErrorMessage(payload);
        throw new Error(message ?? "Erro ao enviar imagem.");
      }

      const api = parseApiResponse<{ imageUrl: string | null }>(payload);
      const storedImageUrl = api?.success ? (api.data?.imageUrl ?? null) : null;
      if (!storedImageUrl) {
        throw new Error("Resposta inválida ao atualizar imagem de perfil.");
      }

      const normalizedUrl = normalizeUploadsSrc(storedImageUrl);
      setPreviewUrl(toDisplayUploadsSrc(normalizedUrl));
      setIsInvalid(false);
      updateUser({ image: normalizedUrl });

      toast({
        type: "success",
        title: "Imagem atualizada",
        description: "Sua imagem de perfil foi alterada com sucesso.",
      });
    } catch (error) {
      console.error("❌ [COMPONENT_PHOTO_UPLOAD] Erro no upload:", { error });
      setIsInvalid(true);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao fazer upload da imagem. Tente novamente.";
      setInvalidMessage(errorMessage);
      toast({ type: "error", title: "Erro no upload" });
    } finally {
      setIsUploading(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(
        config.getApiUrl("/api/user-profile-image"),
        { method: "DELETE" },
      );
      if (response.ok) {
        setPreviewUrl(null);

        // Atualizar contexto removendo imagem
        updateUser({ image: "/images/profile.png" });

        toast({
          type: "success",
          title: "Imagem removida",
          description: "Sua imagem de perfil foi removida.",
        });
      } else {
        const message = await getResponseErrorMessage(response);
        throw new Error(message ?? "Não foi possível remover a imagem.");
      }
    } catch (err) {
      setIsInvalid(true);
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao remover imagem";
      setInvalidMessage(errorMessage);
      toast({ type: "error", title: errorMessage });
    }
  };

  return (
    <div className={twMerge(clsx("flex w-full", className))}>
      <div className="flex w-full gap-4">
        {/* Avatar/Preview */}
        <div className="flex items-center justify-center">
          <div className="group relative flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-100 transition duration-200 hover:border-zinc-400 hover:bg-zinc-200 hover:ring-2 hover:ring-zinc-300">
            {previewUrl ? (
              <Image
                src={previewUrl}
                onError={() => setPreviewUrl(null)}
                alt="Preview da imagem"
                fill
                sizes="80px"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <span className="icon-[lucide--circle-user-round] size-9 text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500" />
            )}
          </div>
        </div>

        {/* Infos e ações */}
        <div className="flex flex-col justify-center gap-2">
          <div
            className={twMerge(
              clsx("block font-semibold", isInvalid && "text-red-500"),
            )}
          >
          </div>

          <div className="flex gap-2">
            {/* Input de arquivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Botão de upload */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="icon-[lucide--upload] size-4" />
              {isUploading ? "Enviando..." : "Alterar"}
            </button>

            {/* Botão de apagar */}
            <button
              type="button"
              className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100"
              onClick={handleDelete}
            >
              <span className="icon-[lucide--trash] size-4" /> Apagar
            </button>
          </div>

          <p
            className={twMerge(
              clsx(
                "mt-1 text-xs",
                isInvalid ? "text-red-500" : "text-zinc-400",
              ),
            )}
          >
            {isInvalid ? invalidMessage : "Formatos aceitos: jpg, png ou webp."}
          </p>
        </div>
      </div>
    </div>
  );
}
