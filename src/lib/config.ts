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
 * - APP_URL_DEV / APP_URL_PROD: URL base da aplicação, sempre incluindo o basePath
 * - DATABASE_URL_DEV / DATABASE_URL_PROD: URLs do banco PostgreSQL
 *
 * Para chamadas HTTP internas, use sempre config.getApiUrl('/api/...').
 */

/**
 * Configurações de URLs do sistema
 */
export const config = {
  /**
   * Ambiente de execução
   */
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },

  get publicBasePath(): string {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/silo";
    return basePath === "/" ? "" : basePath.replace(/\/$/, "");
  },

  getPublicPath(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.publicBasePath}${normalizedPath}`;
  },

  /**
   * URL base da aplicação incluindo basePath (ex.: http://localhost:3000/silo)
   * Usa APP_URL_DEV em desenvolvimento e APP_URL_PROD em produção.
   */
  get appUrl(): string {
    const isProd = process.env.NODE_ENV === "production";
    const url = isProd ? process.env.APP_URL_PROD : process.env.APP_URL_DEV;
    if (!url && isProd) {
      throw new Error("APP_URL_PROD deve ser configurada em produção");
    }
    return url || "";
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
   * URL de callback do Google OAuth
   * Usado para autenticação Google
   */
  get googleCallbackUrl(): string {
    const base = config.appUrl;
    if (!base) return "";
    return `${base.replace(/\/$/, "")}/api/auth/callback/google`;
  },

  /**
   * URL do banco de dados
   * Usa DATABASE_URL_DEV/DATABASE_URL_PROD e aceita DATABASE_URL como fallback.
   * Em produção, DATABASE_URL_PROD deve estar sempre definida.
   */
  get databaseUrl(): string {
    const isProd = process.env.NODE_ENV === "production";
    const primary = isProd
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;
    const fallback = process.env.DATABASE_URL;
    const url = primary || fallback;

    if (!url && isProd) {
      throw new Error("DATABASE_URL_PROD deve ser configurada em produção");
    }

    return url || "";
  },

  /**
   * Credenciais do Google OAuth
   * Centraliza acesso aos valores sensíveis
   */
  get googleClientId(): string {
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id && process.env.NODE_ENV === "production") {
      throw new Error("GOOGLE_CLIENT_ID deve ser configurada em produção");
    }
    return id || "";
  },

  get googleClientSecret(): string {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("GOOGLE_CLIENT_SECRET deve ser configurada em produção");
    }
    return secret || "";
  },

  /**
   * Configurações de email (SMTP)
   */
  get email() {
    const host = (process.env.SMTP_HOST || "").trim();
    const portRaw = (process.env.SMTP_PORT || "587").trim();
    const secure = process.env.SMTP_SECURE === "true";
    const username = (process.env.SMTP_USERNAME || "").trim();
    const password = (process.env.SMTP_PASSWORD || "").trim();
    const fromEnv = (process.env.SMTP_FROM || "").trim();
    const from =
      fromEnv.length > 0
        ? fromEnv
        : username.includes("@")
          ? username
          : username.length > 0
            ? `${username}@inpe.br`
            : "";

    if (process.env.NODE_ENV === "production") {
      const missing: string[] = [];
      if (!host) missing.push("SMTP_HOST");
      if (!portRaw) missing.push("SMTP_PORT");
      if (!username) missing.push("SMTP_USERNAME");
      if (!password) missing.push("SMTP_PASSWORD");
      if (missing.length > 0) {
        throw new Error(
          `Variáveis SMTP obrigatórias não configuradas em produção: ${missing.join(", ")}`,
        );
      }
    }

    const port = Number.parseInt(portRaw, 10);
    return { host, port, secure, username, password, from };
  },
};

/**
 * Utilitários para extrair informações de requisições HTTP
 */
export const requestUtils = {
  /**
   * Extrai o host completo de uma requisição HTTP
   * Considera headers de proxy (x-forwarded-proto, x-forwarded-host)
   */
  getHostFromRequest(req: Request): string {
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host =
      req.headers.get("host") || config.appUrl.replace(/^https?:\/\//, "");
    return `${protocol}://${host}`;
  },

  /**
   * Verifica se uma URL é do servidor de arquivos local
   */
  isFileServerUrl(url: string): boolean {
    const normalizedUrl = url.split("?")[0] || "";
    if (normalizedUrl.startsWith("/uploads/")) return true;

    const trimSlash = (value: string): string => value.replace(/\/$/, "");
    const bases = [config.appUrl].filter((v) => v.length > 0).map(trimSlash);
    return bases.some((base) => normalizedUrl.includes(`${base}/uploads/`));
  },

  /**
   * Extrai o caminho do arquivo de uma URL do servidor de arquivos
   */
  extractFilePath(url: string): string | null {
    const normalizedUrl = url.split("?")[0] || "";
    if (normalizedUrl.startsWith("/uploads/"))
      return normalizedUrl.slice("/uploads/".length);

    const uploadsIndex = normalizedUrl.indexOf("/uploads/");
    if (uploadsIndex !== -1)
      return normalizedUrl.slice(uploadsIndex + "/uploads/".length);

    return null;
  },

  /**
   * Constrói URL de delete para um arquivo no servidor de arquivos
   */
  buildDeleteUrl(filePath: string, baseUrl?: string): string {
    const base = (baseUrl || config.appUrl).replace(/\/$/, "");
    if (!base) return `/uploads/${filePath}`;
    return `${base}/uploads/${filePath}`;
  },
};

/**
 * Validações de configuração para produção
 */
export const configValidation = {
  /**
   * Valida se todas as configurações necessárias estão definidas
   * Deve ser chamada na inicialização da aplicação em produção
   */
  validateProductionConfig(): { status: "skipped" | "validated" } {
    // Não executar durante o build (Next.js define NODE_ENV como 'production' durante build)
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PHASE === "phase-production-build"
    ) {
      return { status: "skipped" };
    }

    const requiredVars = ["APP_URL_PROD", "DATABASE_URL_PROD"];

    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `Variáveis de ambiente obrigatórias não configuradas em produção: ${missingVars.join(", ")}`,
      );
    }

    new URL(config.appUrl);
    new URL(config.googleCallbackUrl);

    return { status: "validated" };
  },
};
