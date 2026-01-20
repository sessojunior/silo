import { db } from "@/lib/db";
import { authAccount } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getGoogleIdFromUserId(
  userId: string,
): Promise<{ googleId: string | null }> {
  const account = await db.query.authAccount.findFirst({
    where: and(
      eq(authAccount.userId, userId),
      eq(authAccount.providerId, "google"),
    ),
  });

  return { googleId: account?.accountId || null };
}
