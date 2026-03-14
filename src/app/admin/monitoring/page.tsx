import MonitoringPageClient from "@/components/admin/monitoring/MonitoringPageClient";
import { db } from "@/lib/db";
import { product, picturePage, pictureLink, radarGroup, radar } from "@/lib/db/schema";
import type { PicturePage as DBPicturePage, PictureLink as DBPictureLink } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seedMonitoringProducts as PRODUCTS_DATA } from "@/lib/db/seedProducts";
import { seedPictures } from "@/lib/db/seedPictures";

import type {
  MonitoringProductItem,
  MonitoringProductsFile,
} from "@/components/admin/monitoring/ProductMonitoringCards";
import { 
  DbRadarGroup,
  DbRadar,
} from "@/components/admin/monitoring/MonitoringPageClient";
import { SeedMonitoringProduct, SeedPicturePage } from "@/lib/db/seedTypes";
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

function normalizeModelKey(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findMatchingActiveProduct(
  mockProduct: MonitoringProductItem,
  activeProducts: ActiveProduct[],
): ActiveProduct | null {
  const mockId = normalizeModelKey(mockProduct.productId);
  const modelKey = normalizeModelKey(mockProduct.model);

  for (const activeProduct of activeProducts) {
    const activeSlug = normalizeModelKey(activeProduct.slug);
    const activeName = normalizeModelKey(activeProduct.name);

    if (
      activeSlug === mockId ||
      activeSlug === modelKey ||
      activeName === mockId ||
      activeName === modelKey ||
      activeSlug.includes(modelKey) ||
      modelKey.includes(activeSlug) ||
      activeName.includes(modelKey) ||
      modelKey.includes(activeName) ||
      activeSlug.includes(mockId) ||
      mockId.includes(activeSlug)
    ) {
      return activeProduct;
    }
  }

  return null;
}

export default async function DashboardMonitoringPage() {
  const activeProducts = await db
    .select({ slug: product.slug, name: product.name })
    .from(product)
    .where(eq(product.available, true));

  const productsDataTyped = PRODUCTS_DATA as unknown as { referenceDate: string; products: SeedMonitoringProduct[] };

  const filteredProductsData: MonitoringProductsFile = {
    referenceDate: productsDataTyped.referenceDate,
    products: productsDataTyped.products
      .map((mockProduct) => {
        const matchedProduct = findMatchingActiveProduct(
          mockProduct as unknown as MonitoringProductItem,
          activeProducts,
        );

        if (!matchedProduct) {
          return null;
        }

        return {
          ...mockProduct,
          productId: matchedProduct.slug,
          model: matchedProduct.name,
        } as MonitoringProductItem;
      })
      .filter((productItem): productItem is MonitoringProductItem => productItem !== null),
  };

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
