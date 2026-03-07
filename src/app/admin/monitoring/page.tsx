import MonitoringPageClient from "@/components/admin/monitoring/MonitoringPageClient";
import { db } from "@/lib/db";
import { product } from "@/lib/db/schema";
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

  return <MonitoringPageClient productsData={filteredProductsData} />;
}
