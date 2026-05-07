import MonitoringPageClient from "@/components/admin/monitoring/monitoring-page-client";
import { 
  DbRadarGroup,
  DbRadar,
} from "@/components/admin/monitoring/monitoring-page-client";
import { headers } from "next/headers";
import { config } from "@/lib/config";
import type { 
  PicturePage, 
  PictureLink,
  PictureLinkStatus,
  PictureCheckMode,
} from "@/components/admin/monitoring/picture-pages-accordion";
import type { MonitoringProductsFile } from "@/lib/dataflow/types";

export default async function DashboardMonitoringPage() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const getMonitoringApiUrl = (path: string): string => {
    const apiOrigin = config.apiOrigin || config.appOrigin;
    if (apiOrigin) {
      return new URL(path, apiOrigin).toString();
    }

    return config.getApiUrl(path);
  };

  const sharedHeaders = cookieHeader ? { cookie: cookieHeader } : undefined;

  const [productsRes, pagesRes, radarGroupsRes, radarsRes] = await Promise.all([
    fetch(getMonitoringApiUrl("/api/products?available=true"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(getMonitoringApiUrl("/api/monitoring/picture-pages"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(getMonitoringApiUrl("/api/monitoring/radar-groups"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(getMonitoringApiUrl("/api/monitoring/radars"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
  ]);

  const productsJson = productsRes.ok ? await productsRes.json() as { success: boolean; data?: { items?: { slug: string; name: string }[] } } : null;
  const activeProducts = productsJson?.data?.items?.map((p) => ({ slug: p.slug, name: p.name })) ?? [];

  // Get monitoring products data via API
  const monitoringRes = await fetch(getMonitoringApiUrl("/api/monitoring/products"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sharedHeaders ?? {}),
    },
    body: JSON.stringify({ products: activeProducts }),
    cache: "no-store",
  });
  const filteredProductsData: MonitoringProductsFile = monitoringRes.ok
    ? (await monitoringRes.json() as { success: boolean; data?: MonitoringProductsFile }).data ?? { referenceDate: "", products: [] }
    : { referenceDate: "", products: [] };

  const pagesJson = pagesRes.ok ? await pagesRes.json() as { success: boolean; data?: { items?: PicturePage[] } } : null;
  const picturePagesResult: PicturePage[] = (pagesJson?.data?.items ?? []).map((p) => ({
    ...p,
    checkMode: p.checkMode as unknown as PictureCheckMode,
    status: p.status as unknown as PictureLinkStatus,
    links: (p.links ?? []).map((l: PictureLink) => ({
      ...l,
      status: l.status as unknown as PictureLinkStatus,
    })),
  }));

  const radarGroupsJson = radarGroupsRes.ok ? await radarGroupsRes.json() as { success: boolean; data?: { items?: DbRadarGroup[] } } : null;
  const radarGroupsResult = radarGroupsJson?.data?.items ?? [];

  const radarsJson = radarsRes.ok ? await radarsRes.json() as { success: boolean; data?: { items?: DbRadar[] } } : null;
  const radarsResult = radarsJson?.data?.items ?? [];

  return (
    <MonitoringPageClient 
      productsData={filteredProductsData} 
      picturePages={picturePagesResult}
      radarGroups={radarGroupsResult as unknown as DbRadarGroup[]}
      radars={radarsResult as unknown as DbRadar[]}
    />
  );
}
