import { normalizeUploadsSrc } from "@silo/engine/format/ui";

import { config } from "@/lib/config";

const isExternalUploadsSource = (value: string): boolean =>
  value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://");

export function toStoredUploadsSrc(input: string): string {
  return normalizeUploadsSrc(input);
}

export function toPublicUploadsSrc(input: string): string {
  if (isExternalUploadsSource(input)) {
    return input;
  }

  const normalized = normalizeUploadsSrc(input);
  if (normalized.startsWith("/uploads/")) {
    return config.getPublicPath(normalized);
  }

  return normalized;
}