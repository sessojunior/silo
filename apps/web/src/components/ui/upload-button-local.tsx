"use client";

import { useState, useRef } from "react";
import { toast } from "@silo/engine/format/toast";
import { config } from "@/lib/config";

type UploadItem = {
  url: string;
  key?: string;
  name?: string;
  size?: number;
};

interface UploadButtonLocalProps {
  endpoint?:
    | "general"
    | "avatarUploader"
    | "contactImageUploader"
    | "incidentImageUploader"
    | "problemImageUploader"
    | "solutionImageUploader"
    | "manualImageUploader"
    | "helpImageUploader"
    | "projectImageUploader";
  onClientUploadComplete?: (
    res:
      | { url: string; key?: string; name?: string; size?: number }
      | { url: string; key?: string; name?: string; size?: number }[],
  ) => void;
  onUploadError?: (error: { message: string }) => void;
  appearance?: {
    button?: string;
    container?: string;
    allowedContent?: string;
  };
  content?: {
    button?: React.ReactNode;
    allowedContent?: string;
  };

  className?: string;
  disabled?: boolean;
}

export default function UploadButtonLocal({
  endpoint = "general",
  onClientUploadComplete,
  onUploadError,
  appearance,
  content,
  className,
  disabled = false,
}: UploadButtonLocalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endpointKindMap: Record<NonNullable<UploadButtonLocalProps["endpoint"]>, string> = {
    general: "general",
    avatarUploader: "avatars",
    contactImageUploader: "contacts",
    incidentImageUploader: "incidents",
    problemImageUploader: "problems",
    solutionImageUploader: "solutions",
    manualImageUploader: "manual",
    helpImageUploader: "help",
    projectImageUploader: "projects",
  };

  const multiUploadEndpoints = new Set<NonNullable<UploadButtonLocalProps["endpoint"]>>([
    "problemImageUploader",
    "incidentImageUploader",
    "solutionImageUploader",
    "manualImageUploader",
    "helpImageUploader",
    "projectImageUploader",
  ]);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const normalizeUploadItem = (payload: unknown): UploadItem | null => {
    if (!isRecord(payload)) return null;

    if (typeof payload.url === "string") {
      return {
        url: payload.url,
        ...(typeof payload.key === "string" ? { key: payload.key } : {}),
        ...(typeof payload.name === "string" ? { name: payload.name } : {}),
        ...(typeof payload.size === "number" ? { size: payload.size } : {}),
      };
    }

    if (typeof payload.success === "boolean") {
      const data = payload.data;
      if (isRecord(data) && typeof data.url === "string") {
        const filename = typeof data.filename === "string" ? data.filename : undefined;
        return {
          url: data.url,
          ...(filename ? { key: filename, name: filename } : {}),
        };
      }
    }

    return null;
  };

  const uploadSingleFile = async (file: File): Promise<UploadItem> => {
    const uploadKind = endpointKindMap[endpoint];
    const uploadEndpoint = config.getApiUrl(`/api/upload/${uploadKind}`);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(uploadEndpoint, {
      method: "POST",
      body: formData,
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (isRecord(payload) && typeof payload.error === "string" && payload.error.trim().length > 0)
          ? payload.error
          : `Erro no upload: ${response.status}`;
      throw new Error(message);
    }

    const item = normalizeUploadItem(payload);
    if (!item) {
      throw new Error("Resposta inválida do upload.");
    }

    return item;
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const validateFiles = (items: File[]): string | null => {
      for (const file of items) {
        if (!allowedTypes.includes(file.type)) {
          return `Tipo de arquivo não permitido: ${file.name}`;
        }
        if (file.size > 4 * 1024 * 1024) {
          return `Arquivo muito grande: ${file.name}`;
        }
      }
      return null;
    };
    const validationError = validateFiles(fileArray);
    if (validationError) {
      if (onUploadError) {
        onUploadError({ message: validationError });
      } else {
        toast({ type: "error", title: validationError });
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);

    try {
      const uploadedItems = multiUploadEndpoints.has(endpoint)
        ? await Promise.all(fileArray.map(async (file) => uploadSingleFile(file)))
        : [await uploadSingleFile(fileArray[0])];

      if (onClientUploadComplete) {
        onClientUploadComplete(
          multiUploadEndpoints.has(endpoint) ? uploadedItems : uploadedItems[0],
        );
      }
    } catch (error) {
      let errorMessage = "Erro no upload";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object") {
        const maybeMessage = (error as Record<string, unknown>).message;
        if (
          typeof maybeMessage === "string" &&
          maybeMessage.trim().length > 0
        ) {
          errorMessage = maybeMessage;
        }
      }
      console.error(
        "? [COMPONENT_UPLOAD_BUTTON] Erro no upload:",
        errorMessage,
      );
      if (onUploadError) {
        onUploadError({ message: errorMessage });
      } else {
        toast({ type: "error", title: errorMessage });
      }
    } finally {
      setIsUploading(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={appearance?.container || ""}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={
          endpoint === "problemImageUploader" ||
          endpoint === "incidentImageUploader" ||
          endpoint === "solutionImageUploader" ||
          endpoint === "manualImageUploader" ||
          endpoint === "helpImageUploader" ||
          endpoint === "projectImageUploader"
        }
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className={`${appearance?.button || "btn btn-primary"} ${className || ""} ${disabled || isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isUploading ? (
          <>
            <span className="icon-[lucide--loader-2] size-4 animate-spin" />
            <span className="ml-2">Enviando...</span>
          </>
        ) : (
          content?.button || "Selecionar arquivo"
        )}
      </button>
      {content?.allowedContent && (
        <p
          className={`text-xs text-muted-foreground mt-1 ${appearance?.allowedContent || ""}`}
        >
          {content.allowedContent}
        </p>
      )}
    </div>
  );
}
