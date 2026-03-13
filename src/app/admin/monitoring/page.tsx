import MonitoringPageClient from "@/components/admin/monitoring/MonitoringPageClient";
import { db } from "@/lib/db";
import { product, picturePage, pictureLink } from "@/lib/db/schema";
import type { PicturePage as DBPicturePage, PictureLink as DBPictureLink } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import productsJson from "./products.json";

import type {
  MonitoringProductItem,
  MonitoringProductsFile,
} from "@/components/admin/monitoring/ProductMonitoringCards";

type ActiveProduct = {
  slug: string;
  name: string;
};

const PRODUCTS_DATA = productsJson as MonitoringProductsFile;

function normalizeModelKey(value: string): string {
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

  const filteredProductsData: MonitoringProductsFile = {
    referenceDate: PRODUCTS_DATA.referenceDate,
    products: PRODUCTS_DATA.products
      .map((mockProduct) => {
        const matchedProduct = findMatchingActiveProduct(
          mockProduct,
          activeProducts,
        );

        if (!matchedProduct) {
          return null;
        }

        return {
          ...mockProduct,
          productId: matchedProduct.slug,
          model: matchedProduct.name,
        };
      })
      .filter((productItem): productItem is MonitoringProductItem => productItem !== null),
  };

  // Load picture pages from DB if present, otherwise fallback to static JSON
  const pagesFromDbRows = (await db.select().from(picturePage).orderBy(picturePage.name)) as DBPicturePage[];
  let picturePages = (await import("./pictures.json")).pages as unknown[];
  if (pagesFromDbRows.length > 0) {
    const linkRows = (await db.select().from(pictureLink)) as DBPictureLink[];
    const linksByPage: Record<string, DBPictureLink[]> = {};
    for (const l of linkRows) {
      const key = l.pageId;
      if (!linksByPage[key]) linksByPage[key] = [];
      linksByPage[key].push(l);
    }

    picturePages = pagesFromDbRows.map((p) => {
      const links = (linksByPage[p.id] || []).map((l) => ({
        id: l.id,
        name: l.name,
        url: l.url,
        size: l.size,
        lastUpdate: l.lastUpdate ? l.lastUpdate.toISOString() : "",
        delay: l.delay || "",
        delayMinutes: l.delayMinutes ?? null,
        status: l.status || "ok",
      }));

      return {
        id: p.id,
        name: p.name,
        url: p.url,
        description: p.description,
        checkMode: p.checkMode || "page",
        status: p.status || "ok",
        delay: p.delay || "",
        delayMinutes: p.delayMinutes ?? null,
        delayedLinks: p.delayedLinks ?? links.filter((l) => l.status !== "ok").length,
        offlineLinks: p.offlineLinks ?? links.filter((l) => l.status === "offline").length,
        links,
      };
    });
  }

  return <MonitoringPageClient productsData={filteredProductsData} picturePages={picturePages} />;
}
