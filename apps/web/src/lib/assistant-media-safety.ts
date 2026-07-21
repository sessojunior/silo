const MAX_DATA_URI_BYTES = 512 * 1024;

const LOCAL_IMAGE_PREFIXES = [
  "/uploads/general/",
  "/uploads/avatars/",
  "/uploads/contacts/",
  "/uploads/incidents/",
  "/uploads/problems/",
  "/uploads/solutions/",
  "/uploads/manual/",
  "/uploads/help/",
  "/uploads/projects/",
] as const;

const LOCAL_PDF_PREFIXES = [
  "/api/upload/serve/reports/",
  "/uploads/serve/reports/",
] as const;

const LOCAL_IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|svg)$/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SVG_ACTIVE_CONTENT_PATTERN =
  /<\s*(script|foreignObject|iframe|object|embed|image)\b|on[a-z]+\s*=|\b(?:href|xlink:href|src)\s*=|javascript\s*:|url\s*\(|<\s*link\b|<\s*meta\b/i;

export const ASSISTANT_MEDIA_CSP_DIRECTIVES = {
  imgSrc: ["'self'", "data:"] as const,
  frameSrc: ["'self'"] as const,
};

function decodeLocalPath(source: string): string | null {
  const trimmed = source.trim();

  if (
    trimmed.length === 0 ||
    CONTROL_CHARACTER_PATTERN.test(trimmed) ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("://")
  ) {
    return null;
  }

  let decoded = trimmed;
  for (let index = 0; index < 2; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }

  if (
    CONTROL_CHARACTER_PATTERN.test(decoded) ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("://") ||
    decoded.includes("?") ||
    decoded.includes("#")
  ) {
    return null;
  }

  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "..")) {
    return null;
  }

  return decoded;
}

function startsWithAllowedPrefix(
  source: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => source.startsWith(prefix));
}

function decodedByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function decodeBase64Payload(payload: string): string | null {
  try {
    return atob(payload);
  } catch {
    return null;
  }
}

function decodeSvgDataUri(source: string): string | null {
  const svgUtf8Prefix = "data:image/svg+xml;charset=UTF-8,";
  const svgBase64Prefix = "data:image/svg+xml;base64,";

  if (source.startsWith(svgUtf8Prefix)) {
    try {
      return decodeURIComponent(source.slice(svgUtf8Prefix.length));
    } catch {
      return null;
    }
  }

  if (source.startsWith(svgBase64Prefix)) {
    return decodeBase64Payload(source.slice(svgBase64Prefix.length));
  }

  return null;
}

export function isSafeSvgDataUri(source: string): boolean {
  if (decodedByteLength(source) > MAX_DATA_URI_BYTES) {
    return false;
  }

  const decoded = decodeSvgDataUri(source);
  if (!decoded) {
    return false;
  }

  return !SVG_ACTIVE_CONTENT_PATTERN.test(decoded);
}

export function isSafeRasterDataUri(source: string): boolean {
  if (decodedByteLength(source) > MAX_DATA_URI_BYTES) {
    return false;
  }

  return /^(data:image\/(?:png|jpeg|webp);base64,)[a-z0-9+/]+=*$/i.test(source);
}

export function getSafeAssistantImageSource(source: string): string | null {
  if (isSafeSvgDataUri(source) || isSafeRasterDataUri(source)) {
    return source;
  }

  const localPath = decodeLocalPath(source);
  if (!localPath) {
    return null;
  }

  if (
    !startsWithAllowedPrefix(localPath, LOCAL_IMAGE_PREFIXES) ||
    !LOCAL_IMAGE_EXTENSION_PATTERN.test(localPath)
  ) {
    return null;
  }

  return localPath;
}

export function getSafeAssistantPdfFrameSource(source: string): string | null {
  const localPath = decodeLocalPath(source);
  if (!localPath) {
    return null;
  }

  if (
    !startsWithAllowedPrefix(localPath, LOCAL_PDF_PREFIXES) ||
    !localPath.toLowerCase().endsWith(".pdf")
  ) {
    return null;
  }

  return localPath;
}
