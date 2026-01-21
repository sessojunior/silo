import { config } from "@/lib/config";

export const authApiPath = "/api/auth";
export const postLoginRedirectPath = "/admin/dashboard";

export const getAuthClientBaseURL = (): string => {
  const path = config.getApiUrl(authApiPath);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
};

export const getAuthServerBaseURL = (): string | undefined => {
  const origin = config.appOrigin;
  return origin.length > 0 ? origin : undefined;
};
