import { config } from "@/lib/config";

const STATIC_PAGE_TITLES: Record<string, string> = {
  "/admin": "Visão geral",
  "/admin/dashboard": "Visão geral",
  "/admin/dashboard/monitoramento": "Monitoramento",
  "/admin/products": "Produtos & tasks",
  "/admin/projects": "Projetos ativos",
  "/admin/reports": "Relatórios",
  "/admin/groups": "Grupos & usuários",
  "/admin/groups/users": "Usuários",
  "/admin/chat": "Bate-papo",
  "/admin/settings": "Configurações",
  "/admin/settings/products": "Produtos & tasks",
  "/admin/contacts": "Contatos",
  "/admin/help": "Ajuda",
};

const REPORT_PAGE_TITLES: Record<string, string> = {
  availability: "Disponibilidade por Produto",
  problems: "Problemas Mais Frequentes",
  projects: "Projetos e Atividades",
};

type DynamicTitleInput = {
  productsBySlug?: Map<string, string>;
  projectsById?: Map<string, string>;
};

const normalizePathname = (pathname: string): string => {
  const raw = pathname.trim() || "/";
  const withoutQuery = raw.split("?")[0].split("#")[0] || "/";

  const basePath = config.publicBasePath;
  const withoutBasePath =
    basePath &&
    (withoutQuery === basePath || withoutQuery.startsWith(`${basePath}/`))
      ? withoutQuery.slice(basePath.length) || "/"
      : withoutQuery;

  const normalized = withoutBasePath.startsWith("/")
    ? withoutBasePath
    : `/${withoutBasePath}`;

  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

export const getAdminTopbarBackHref = (pathname: string): string | null => {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split("/").filter(Boolean);

  if (segments[0] !== "admin") return null;

  // /admin/projects/:projectId -> /admin/projects
  if (segments[1] === "projects" && segments.length === 3) {
    return "/admin/projects";
  }

  // /admin/projects/:projectId/activities/:activityId -> /admin/projects/:projectId
  if (
    segments[1] === "projects" &&
    segments.length >= 5 &&
    segments[3] === "activities"
  ) {
    return `/admin/projects/${segments[2]}`;
  }

  return null;
};

const fallbackFromSegment = (segment: string): string => {
  const readable = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  if (!readable) return "";

  const compact = readable.replace(/\s+/g, "");
  if (/^[a-z0-9]+$/.test(compact) && compact.length <= 6) {
    return compact.toUpperCase();
  }

  return readable
    .split(" ")
    .map((word) =>
      word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : "",
    )
    .join(" ");
};

export const getAdminDynamicTarget = (
  pathname: string,
): "product" | "project" | null => {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split("/").filter(Boolean);

  if (segments[0] !== "admin") return null;
  if (segments[1] === "products" && segments[2]) return "product";
  if (segments[1] === "projects" && segments[2]) return "project";

  return null;
};

export const resolveAdminPageTitle = (
  pathname: string,
  dynamicInput: DynamicTitleInput = {},
): string => {
  const normalized = normalizePathname(pathname);

  if (STATIC_PAGE_TITLES[normalized]) {
    return STATIC_PAGE_TITLES[normalized];
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] !== "admin") return "Administração do Silo";

  if (segments[1] === "products") {
    const slug = segments[2];
    if (!slug) return STATIC_PAGE_TITLES["/admin/products"];

    const productName = dynamicInput.productsBySlug?.get(slug);
    return productName || fallbackFromSegment(slug) || "Produtos & tasks";
  }

  if (segments[1] === "projects") {
    const projectId = segments[2];
    if (!projectId) return STATIC_PAGE_TITLES["/admin/projects"];

    const projectName = dynamicInput.projectsById?.get(projectId);
    return projectName || "Projeto";
  }

  if (segments[1] === "reports") {
    const reportId = segments[2];
    if (!reportId) return STATIC_PAGE_TITLES["/admin/reports"];
    return REPORT_PAGE_TITLES[reportId] || fallbackFromSegment(reportId);
  }

  if (segments[1] === "settings") {
    return STATIC_PAGE_TITLES["/admin/settings"];
  }

  return "Administração do Silo";
};
