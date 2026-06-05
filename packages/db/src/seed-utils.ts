export function createLocalDate(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(year, month, day);
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