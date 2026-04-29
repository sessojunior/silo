import MonitoringPageClient from "@/components/admin/monitoring/MonitoringPageClient";
import { db } from "@/lib/db";
import { product, picturePage, pictureLink, radarGroup, radar } from "@/lib/db/schema";
import type { PicturePage as DBPicturePage, PictureLink as DBPictureLink } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seedPictures } from "@/lib/db/seedPictures";
import { getMonitoringProductsFromKafkaRest } from "@/lib/dataflow/kafkaDataFlowSource";

import { 
  DbRadarGroup,
  DbRadar,
} from "@/components/admin/monitoring/MonitoringPageClient";
import { SeedPicturePage } from "@/lib/db/seedTypes";
import type { 
  PicturePage, 
  PictureLink,
  PictureLinkStatus,
  PictureCheckMode,
} from "@/components/admin/monitoring/PicturePagesAccordion";

type ActiveProduct = {
  slug: string;
  name: string;
};

export default async function DashboardMonitoringPage() {
  const activeProducts = await db
    .select({ slug: product.slug, name: product.name })
    .from(product)
    .where(eq(product.available, true));

  const filteredProductsData = await getMonitoringProductsFromKafkaRest(
    activeProducts as ActiveProduct[],
  );

  // Load picture pages from DB
  const pagesFromDbRows = (await db.select().from(picturePage).orderBy(picturePage.name)) as DBPicturePage[];
  
  let picturePagesResult: PicturePage[] = [];

  if (pagesFromDbRows.length > 0) {
    const linkRows = (await db.select().from(pictureLink)) as DBPictureLink[];
    const linksByPage: Record<string, DBPictureLink[]> = {};
    for (const l of linkRows) {
      const key = l.pageId;
      if (!linksByPage[key]) linksByPage[key] = [];
      linksByPage[key].push(l);
    }

    picturePagesResult = pagesFromDbRows.map((p) => {
      const links: PictureLink[] = (linksByPage[p.id] || []).map((l) => ({
        id: l.id,
        pageId: l.pageId,
        slug: l.slug || "",
        name: l.name || "",
        url: l.url,
        size: l.size || "",
        lastUpdate: l.lastUpdate ? l.lastUpdate.toISOString() : "",
        delay: l.delay || "",
        delayMinutes: l.delayMinutes ?? null,
        status: (l.status as unknown as PictureLinkStatus) || "ok",
        type: ((l as unknown) as { type: string }).type || "asset",
      }));

      return {
        id: p.id,
        name: p.name,
        slug: p.slug || "",
        url: p.url,
        description: p.description || "",
        checkMode: (p.checkMode as unknown as PictureCheckMode) || "page",
        status: (p.status as unknown as PictureLinkStatus) || "ok",
        delay: p.delay || "",
        delayMinutes: p.delayMinutes ?? null,
        delayedLinks: p.delayedLinks ?? links.filter((l) => l.status !== "ok").length,
        offlineLinks: p.offlineLinks ?? links.filter((l) => l.status === "offline").length,
        links,
      };
    });
  } else {
    // Fallback to TS seed data
    picturePagesResult = (seedPictures as unknown as { pages: SeedPicturePage[] }).pages.map(p => ({
      ...p,
      slug: p.id,
      checkMode: p.checkMode as unknown as PictureCheckMode,
      status: p.status as unknown as PictureLinkStatus,
      links: p.links.map(l => ({
        ...l,
        slug: l.slug || "",
        status: l.status as unknown as PictureLinkStatus,
        type: l.type || "asset"
      }))
    }));
  }
 
  // Load radar groups and radars from DB
  const radarGroupsResult = await db.select().from(radarGroup).orderBy(radarGroup.sortOrder);
  const radarsResult = await db.select().from(radar).orderBy(radar.name);
 
  return (
    <MonitoringPageClient 
      productsData={filteredProductsData} 
      picturePages={picturePagesResult}
      radarGroups={radarGroupsResult as unknown as DbRadarGroup[]}
      radars={radarsResult as unknown as DbRadar[]}
    />
  );
}
