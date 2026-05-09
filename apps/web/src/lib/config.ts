/**
 * Configuração centralizada do sistema SILO
 *
 * Este arquivo centraliza todas as configurações de URLs, hosts e serviços,
 * garantindo que não haja URLs hardcoded em produção.
 *
 * Em produção, todas as variáveis de ambiente críticas devem estar configuradas,
 * caso contrário o sistema falhará explicitamente.
 *
 * Variáveis principais:
 * - NEXT_PUBLIC_BASE_PATH: basePath do Next.js (ex.: /silo)
 * - APP_URL_DEV / APP_URL_PROD: URL base da aplicação (origem), SEM o basePath
 * - API_URL: URL base do apps/api usada pelo proxy do web
 * - NEXT_PUBLIC_API_ORIGIN: origem pública do apps/api para websocket no browser
 * - DATABASE_URL_DEV / DATABASE_URL_PROD: URLs do banco PostgreSQL
 *
 * Para chamadas HTTP internas, use sempre config.getApiUrl('/api/...').
 */

declare global {
  interface Window {
    __SILO_SMOKE_MODE__?: boolean;
  }
}

/**
 * Configurações de URLs do sistema
 */
export const config = {
  /**
   * Versão exibida na interface do web.
   * Mantida como literal no código para evitar dependência de env ou CI.
   */
  appVersion: "26.5.17.4",

  get isSmokeMode(): boolean {
    if (typeof window !== "undefined" && window.__SILO_SMOKE_MODE__ === true) {
      return true;
    }

    const raw = (process.env.NEXT_PUBLIC_SMOKE_MODE || "").trim().toLowerCase();
    return raw === "true";
  },

  get publicBasePath(): string {
    const raw = (process.env.NEXT_PUBLIC_BASE_PATH || "/silo").trim();
    if (raw.length === 0 || raw === "/") return "";

    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/$/, "");
  },

  getPublicPath(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const basePath = this.publicBasePath;
    if (!basePath) return normalizedPath;
    if (normalizedPath === basePath) return normalizedPath;
    if (normalizedPath.startsWith(`${basePath}/`)) return normalizedPath;
    return `${basePath}${normalizedPath}`;
  },

  /**
   * URL base da aplicação incluindo basePath (ex.: http://localhost:3000/silo)
   * Usa APP_URL_DEV em desenvolvimento e APP_URL_PROD em produção.
   */
  get appOrigin(): string {
    const isProd = process.env.NODE_ENV === "production";
    const url = isProd ? process.env.APP_URL_PROD : process.env.APP_URL_DEV;
    if (!url && isProd) {
      throw new Error("APP_URL_PROD deve ser configurada em produção");
    }
    if (!url) return "";

    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  },

  get appUrl(): string {
    const origin = this.appOrigin;
    if (!origin) return "";
    return `${origin}${this.publicBasePath}`;
  },

  /**
   * Origem pública do apps/api para uso no browser.
   * Deve ser uma URL absoluta, sem path.
   */
  get apiOrigin(): string {
    const raw = (process.env.NEXT_PUBLIC_API_ORIGIN || process.env.API_URL || "").trim();
    if (!raw) return "";

    try {
      return new URL(raw).origin;
    } catch {
      return "";
    }
  },

  /**
   * Constrói URL para chamadas de API respeitando o basePath da aplicação.
   *
   * - Em ambiente client, retorna sempre um path relativo (ex.: /silo/api/auth/login)
   * - Em ambiente server, concatena APP_URL_DEV/APP_URL_PROD com o path normalizado
   *
   * Exemplo:
   * const url = config.getApiUrl('/api/auth/login')
   * // Client: '/silo/api/auth/login'
   * // Server (dev): 'http://localhost:3000/silo/api/auth/login'
   */
  getApiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (typeof window !== "undefined") {
      return this.getPublicPath(normalizedPath);
    }

    const base = this.appUrl;
    if (!base) return normalizedPath;
    return `${base.replace(/\/$/, "")}${normalizedPath}`;
  },

  /**
   * Constrói a URL do websocket do chat usando a origem pública da API.
   */
  getChatRealtimeUrl(): string {
    const origin = this.apiOrigin;
    if (!origin) {
      throw new Error("NEXT_PUBLIC_API_ORIGIN deve ser configurada para o chat realtime");
    }

    const url = new URL("/api/chat/ws", origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  },

};
