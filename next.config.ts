import type { NextConfig } from "next";

const parseAppUrl = (): {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
} | null => {
  const isProd = process.env.NODE_ENV === "production";
  const raw = isProd ? process.env.APP_URL_PROD : process.env.APP_URL_DEV;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const protocol = (url.protocol.replace(":", "") || "https") as
      | "http"
      | "https";
    const hostname = url.hostname;
    const port = url.port || undefined;
    const pathname = url.pathname || "/";
    return { protocol, hostname, port, pathname };
  } catch {
    return null;
  }
};

const appUrl = parseAppUrl();
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/silo";
const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  images: {
    localPatterns: [
      {
        pathname: "/uploads/**",
      },
      {
        pathname: `${normalizedBasePath}/uploads/**`,
      },
      {
        pathname: "/images/**",
      },
      {
        pathname: `${normalizedBasePath}/images/**`,
      },
    ],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3000",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3001",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/uploads/**",
      },
      ...(appUrl
        ? [
            {
              protocol: appUrl.protocol,
              hostname: appUrl.hostname,
              port: appUrl.port,
              pathname: `${appUrl.pathname.replace(/\/$/, "")}/uploads/**`,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
