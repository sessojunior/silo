import type { NextConfig } from "next";
import { config } from "./src/lib/config";

const normalizedBasePath = config.publicBasePath;
const appOrigin = (() => {
  if (!config.appOrigin) return null;
  try {
    const url = new URL(config.appOrigin);
    const protocol = (url.protocol.replace(":", "") || "https") as
      | "http"
      | "https";
    const hostname = url.hostname;
    const port = url.port || undefined;
    return { protocol, hostname, port };
  } catch {
    return null;
  }
})();

const getRootRedirectDestination = (): string | null => {
  if (!normalizedBasePath || !appOrigin) return null;
  const port = appOrigin.port ? `:${appOrigin.port}` : "";
  return `${appOrigin.protocol}://${appOrigin.hostname}${port}${normalizedBasePath}`;
};

const nextConfig: NextConfig = {
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  output: "standalone",
  transpilePackages: ["@silo/engine"],
  async redirects() {
    const destination = `${normalizedBasePath || ""}/images/logo.png`;
    const rootDestination = getRootRedirectDestination();
    return [
      ...(rootDestination
        ? [
            {
              source: "/",
              destination: rootDestination,
              permanent: false,
              basePath: false as const,
            },
          ]
        : []),
      {
        source: "/favicon.ico",
        destination: destination.startsWith("/")
          ? destination
          : `/${destination}`,
        permanent: false,
        basePath: false as const,
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
