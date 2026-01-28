"use client";

import { useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { config } from "@/lib/config";

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

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
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

      // Determinar endpoint baseado no tipo
      let uploadEndpoint = config.getApiUrl("/api/upload");
      if (endpoint === "avatarUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/avatar");
      } else if (endpoint === "contactImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/contact");
      } else if (endpoint === "incidentImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/incidents");
      } else if (endpoint === "problemImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/problem");
      } else if (endpoint === "solutionImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/solution");
      } else if (endpoint === "manualImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/manual");
      } else if (endpoint === "helpImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/help");
      } else if (endpoint === "projectImageUploader") {
        uploadEndpoint = config.getApiUrl("/api/upload/projects");
      }

      const formData = new FormData();

      // Para problemas e soluções, enviar todos os arquivos de uma vez
      if (
        endpoint === "problemImageUploader" ||
        endpoint === "incidentImageUploader" ||
        endpoint === "solutionImageUploader" ||
        endpoint === "manualImageUploader" ||
        endpoint === "helpImageUploader" ||
        endpoint === "projectImageUploader"
      ) {
        fileArray.forEach((file) => {
          formData.append("files", file);
        });
      } else {
        // Para avatar e contato, apenas o primeiro arquivo
        formData.append("file", fileArray[0]);
      }

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro no upload: ${response.statusText}`);
      }

      const result = await response.json();

      if (onClientUploadComplete) {
        // Adaptar resposta baseada no endpoint
        if (endpoint === "avatarUploader" && result.success) {
          // Endpoint /api/upload/avatar retorna { success: true, data: {...} }
          onClientUploadComplete({
            url: result.data.url,
            key: result.data.key,
            name: result.data.name,
            size: result.data.size,
          });
        } else if (endpoint === "contactImageUploader" && result.success) {
          // Endpoint /api/upload/contact retorna { success: true, data: {...} }
          onClientUploadComplete({
            url: result.data.url,
            key: result.data.key,
            name: result.data.name,
            size: result.data.size,
          });
        } else if (
          (endpoint === "problemImageUploader" ||
            endpoint === "incidentImageUploader" ||
            endpoint === "solutionImageUploader") &&
          result.success
        ) {
          // Endpoints /api/upload/problem e /api/upload/solution retornam { success: true, data: [...] }
          onClientUploadComplete(result.data);
        } else if (endpoint === "manualImageUploader" && result.success) {
          // Endpoint /api/upload/manual retorna { success: true, data: [...] }
          onClientUploadComplete(result.data);
        } else if (
          (endpoint === "helpImageUploader" ||
            endpoint === "projectImageUploader") &&
          result.success
        ) {
          onClientUploadComplete(result.data);
        } else {
          // Endpoint genérico /api/upload retorna { url, key, name, size }
          onClientUploadComplete({
            url: result.url,
            key: result.key,
            name: result.name,
            size: result.size,
          });
        }
      }
    } catch (error) {
      let errorMessage = "Erro no upload";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object") {
        const maybeMessage = (error as Record<string, unknown>).message;
        if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
          errorMessage = maybeMessage;
        }
      }
      console.error("❌ [COMPONENT_UPLOAD_BUTTON] Erro no upload:", errorMessage);
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
