import type { NextConfig } from "next";

const parseAppOrigin = (): {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
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
    return { protocol, hostname, port };
  } catch {
    return null;
  }
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/silo";
const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
const appOrigin = parseAppOrigin();

const nextConfig: NextConfig = {
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  async redirects() {
    const destination = `${normalizedBasePath || ""}/images/logo.png`;
    return [
      {
        source: "/favicon.ico",
        destination: destination.startsWith("/") ? destination : `/${destination}`,
        permanent: false,
        basePath: false,
      },
    ];
  },
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
      ...(appOrigin
        ? [
            {
              protocol: appOrigin.protocol,
              hostname: appOrigin.hostname,
              port: appOrigin.port,
              pathname: `${normalizedBasePath}/uploads/**`,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
