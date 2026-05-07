import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDateBR as formatDateBRFromUtils } from "../date/index";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateBR(dateString: string | null): string {
  if (!dateString) return "Não definida";
  return formatDateBRFromUtils(dateString);
}

export function formatFullDateBR(dateString: string | null): string {
  if (!dateString) return "Não definida";
  return formatDateBRFromUtils(dateString);
}

export function createLocalDate(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(year, month, day);
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function normalizeUploadsSrc(input: string): string {
  const [pathPart, queryPart] = input.split("?");
  const query = queryPart ? `?${queryPart}` : "";
  const pathname = pathPart || "";

  if (pathname.startsWith("/uploads/")) return `${pathname}${query}`;

  const uploadsIdx = pathname.indexOf("/uploads/");
  if (uploadsIdx !== -1) return `${pathname.slice(uploadsIdx)}${query}`;

  const isAllowedKind = (kind: string): boolean =>
    kind === "general" ||
    kind === "avatars" ||
    kind === "contacts" ||
    kind === "problems" ||
    kind === "solutions" ||
    kind === "help" ||
    kind === "projects";

  const normalizePathname = (value: string): string => {
    if (!value.startsWith("/")) return value;
    const segments = value.split("/").filter(Boolean);
    if (segments.length < 2) return value;
    const [prefix, kind] = segments;
    if (prefix === "uploads") return value;
    if (!isAllowedKind(kind)) return value;
    return `/${["uploads", ...segments.slice(1)].join("/")}`;
  };

  try {
    const url = new URL(input);
    const normalizedPathname = normalizePathname(url.pathname);
    if (normalizedPathname === url.pathname) return input;
    return `${url.origin}${normalizedPathname}${url.search}`;
  } catch {
    const normalizedPathname = normalizePathname(pathname);
    if (normalizedPathname === pathname) return input;
    return `${normalizedPathname}${query}`;
  }
}

export function formatSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const computeSecondsLeftFromUnlockAtMs = (unlockAtMs: number): number =>
  Math.max(0, Math.ceil((unlockAtMs - Date.now()) / 1000));

export const createSessionResendCooldown = (
  namespace: string,
): {
  readUnlockAtMs: (email: string) => number | null;
  writeUnlockAtMsFromSeconds: (email: string, seconds: number) => void;
} => {
  const getStorageKey = (email: string): string => {
    const normalizedEmail = email.trim().toLowerCase();
    return `${namespace}:resend-unlock-at:${normalizedEmail}`;
  };

  const readUnlockAtMs = (email: string): number | null => {
    if (typeof window === "undefined") return null;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return null;

    const raw = window.sessionStorage.getItem(getStorageKey(normalizedEmail));
    if (!raw) return null;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const writeUnlockAtMsFromSeconds = (email: string, seconds: number) => {
    if (typeof window === "undefined") return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const unlockAtMs = Date.now() + safeSeconds * 1000;
    window.sessionStorage.setItem(
      getStorageKey(normalizedEmail),
      String(unlockAtMs),
    );
  };

  return { readUnlockAtMs, writeUnlockAtMsFromSeconds };
};
