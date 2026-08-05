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
  
} from "@/components/admin/monitoring/picture-pages-accordion";
import type { MonitoringProductsFile } from "@/lib/dataflow/types";

export default async function DashboardMonitoringPage() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const sharedHeaders = cookieHeader ? { cookie: cookieHeader } : undefined;

  const [productsRes, pagesRes, radarGroupsRes, radarsRes] = await Promise.all([
    fetch(config.getApiUrl("/api/products?available=true"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(config.getApiUrl("/api/monitoring/picture-pages"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(config.getApiUrl("/api/monitoring/radar-groups"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
    fetch(config.getApiUrl("/api/monitoring/radars"), {
      cache: "no-store",
      headers: sharedHeaders,
    }),
  ]);

  const productsJson = productsRes.ok ? await productsRes.json() as { success: boolean; data?: { items?: { slug: string; name: string }[] } } : null;
  const activeProducts = productsJson?.data?.items?.map((p) => ({ slug: p.slug, name: p.name })) ?? [];

  // Get monitoring products data via API
  const monitoringRes = await fetch(config.getApiUrl("/api/monitoring/products"), {
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
    checkMode: p.checkMode,
    status: p.status,
    links: (p.links ?? []).map((l: PictureLink) => ({
      ...l,
      status: l.status,
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
      radarGroups={radarGroupsResult}
      radars={radarsResult}
    />
  );
}
