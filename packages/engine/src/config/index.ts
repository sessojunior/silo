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
 * - DATABASE_URL_DEV / DATABASE_URL_PROD: URLs do banco PostgreSQL
 * - PORT / CORS_ORIGINS / PRODUCT_FLOW_API_KEY / UPLOADS_DIR: ajustes do API Express
 *
 * Para chamadas HTTP internas, use sempre config.getApiUrl('/api/...').
 */

import path from "node:path";

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

  get betterAuthBaseUrl(): string {
    const candidate =
      process.env.BETTER_AUTH_BASE_URL?.trim() ||
      this.appUrl ||
      "http://localhost:3000/silo";

    try {
      return new URL(candidate).toString().replace(/\/$/, "");
    } catch {
      return "http://localhost:3000/silo";
    }
  },

  get betterAuthTrustedOrigins(): string[] {
    const candidates = [
      process.env.APP_URL_DEV,
      process.env.APP_URL_PROD,
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

    if (this.nodeEnv !== "production") {
      candidates.push("http://localhost:*", "http://127.0.0.1:*");
    }

    return Array.from(
      new Set(
        candidates
          .filter((v): v is string => Boolean(v))
          .map((v) => (v.includes("*") ? v.replace(/\/$/, "") : extractOrigin(v)))
          .filter((v): v is string => Boolean(v)),
      ),
    );
  },

  get allowedEmailDomains(): string[] {
    return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean);
  },

  get apiPort(): number {
    const parsedPort = Number.parseInt(process.env.PORT ?? "3001", 10);
    return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3001;
  },

  get apiCorsOrigins(): string[] {
    const rawOrigins = process.env.CORS_ORIGINS?.trim();
    if (!rawOrigins) {
      return ["http://localhost:3000", "http://localhost:3002"];
    }

    return rawOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },

  get productFlowApiKey(): string {
    return (process.env.PRODUCT_FLOW_API_KEY ?? "").trim();
  },

  get uploadsDir(): string {
    return process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads");
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

  getRootRedirectUrl(): string {
    const isProd = this.nodeEnv === "production";
    const basePath = this.publicBasePath;
    const raw = isProd ? process.env.APP_URL_PROD : process.env.APP_URL_DEV;
    const envKey = isProd ? "APP_URL_PROD" : "APP_URL_DEV";
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      throw new Error(`${envKey} deve ser configurada para redirecionamento`);
    }

    let origin: string;
    try {
      origin = new URL(trimmed).origin;
    } catch {
      throw new Error(`${envKey} deve ser uma URL válida`);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");
    return basePath.length > 0
      ? `${normalizedOrigin}${basePath}`
      : normalizedOrigin;
  },

  /**
   * Constrói URL para chamadas de API respeitando o basePath da aplicação.
   */
  getApiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if ("window" in globalThis) {
      return this.getPublicPath(normalizedPath);
    }

    const base = this.appUrl;
    if (!base) return normalizedPath;
    return `${base.replace(/\/$/, "")}${normalizedPath}`;
  },

  /**
   * URL de callback do Google OAuth
   */
  get googleCallbackUrl(): string {
    const base = config.appUrl;
    if (!base) return "";
    return `${base.replace(/\/$/, "")}/api/auth/callback/google`;
  },

  /**
   * Credenciais do Google OAuth
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

  /**
   * Configurações do Kafka REST Proxy
   */
  get kafka() {
    const groupId = process.env.KAFKA_GROUP_ID || "silo-consumer-group";
    const topics = (process.env.KAFKA_TOPICS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const dlqPrefix = process.env.KAFKA_DLQ_PREFIX || "dlq.";
    const processRetryCount = Number(process.env.KAFKA_PROCESS_RETRY_COUNT || "3");
    const retryBackoffMs = Number(process.env.KAFKA_RETRY_BACKOFF_MS || "1000");
    const restProxyUrl = (process.env.KAFKA_REST_PROXY_URL || "").trim();
    const restProxyAuth = (process.env.KAFKA_REST_PROXY_AUTH || "").trim();
    const restProxyUseMockData = process.env.KAFKA_REST_PROXY_USE_MOCK_DATA !== "false";
    const dataFlowTopicPrefix = process.env.KAFKA_DATAFLOW_TOPIC_PREFIX || "silo.dataflow.";

    return {
      groupId,
      topics,
      dlqPrefix,
      processRetryCount,
      retryBackoffMs,
      dataFlowTopicPrefix,
      restProxyAuth,
      restProxyUrl,
      restProxyUseMockData,
    };
  },
};

function extractOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Utilitários para extrair informações de requisições HTTP
 */
export const requestUtils = {
  getHostFromRequest(req: Request): string {
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host =
      req.headers.get("host") || config.appOrigin.replace(/^https?:\/\//, "");
    return `${protocol}://${host}`;
  },

  isFileServerUrl(url: string): boolean {
    const normalizedUrl = url.split("?")[0] || "";
    if (normalizedUrl.startsWith("/uploads/")) return true;

    const trimSlash = (value: string): string => value.replace(/\/$/, "");
    const bases = [config.appUrl].filter((v) => v.length > 0).map(trimSlash);
    return bases.some((base) => normalizedUrl.includes(`${base}/uploads/`));
  },

  extractFilePath(url: string): string | null {
    const normalizedUrl = url.split("?")[0] || "";
    if (normalizedUrl.startsWith("/uploads/"))
      return normalizedUrl.slice("/uploads/".length);

    const uploadsIndex = normalizedUrl.indexOf("/uploads/");
    if (uploadsIndex !== -1)
      return normalizedUrl.slice(uploadsIndex + "/uploads/".length);

    return null;
  },

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
  validateProductionConfig(): { status: "skipped" | "validated" } {
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
