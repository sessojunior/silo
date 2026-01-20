import { config } from "@/lib/config";

export const authApiPath = "/api/auth";
export const postLoginRedirectPath = "/admin/dashboard";

const toOrigin = (value: string): string | undefined => {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

export const getAuthClientBaseURL = (): string => {
  const path = config.getApiUrl(authApiPath);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
};

export const getAuthServerBaseURL = (): string | undefined => {
  const isProd = process.env.NODE_ENV === "production";
  const envUrl = isProd
    ? process.env.BETTER_AUTH_URL || process.env.APP_URL_PROD
    : process.env.APP_URL_DEV || process.env.BETTER_AUTH_URL;

  const fromEnv = envUrl ? toOrigin(envUrl) : undefined;
  if (fromEnv) return fromEnv;

  if (!config.appUrl) return undefined;
  return toOrigin(config.appUrl);
};
