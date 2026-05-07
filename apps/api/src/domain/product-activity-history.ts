import { db } from "@silo/database";
import { productActivityHistory } from "@silo/database/schema";

interface ProductActivityHistoryEntry {
  productActivityId: string;
  userId: string;
  status: string;
  description?: string | null;
  intervention?: string | null;
}

export async function recordProductActivityHistory(entry: ProductActivityHistoryEntry) {
  try {
    await db.insert(productActivityHistory).values(entry);
  } catch (error) {
    console.error("❌ [PRODUCT-ACTIVITY-HISTORY]:", error);
  }
}
