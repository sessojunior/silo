import { db } from "@silo/database";
import { help } from "@silo/database/schema";
import { eq } from "drizzle-orm";

const HELP_ID = "system-help";

type HelpServiceSuccess<T> = {
  ok: true;
  data: T;
};

const success = <T>(data: T): HelpServiceSuccess<T> => ({
  ok: true,
  data,
});

export async function getHelp() {
  let rows = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1);
  if (rows.length === 0) {
    await db.insert(help).values({ id: HELP_ID, description: "" });
    rows = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1);
  }
  return success(rows[0]);
}

export async function updateHelp(description: string) {
  const existing = await db.select().from(help).where(eq(help.id, HELP_ID)).limit(1);
  if (existing.length === 0) {
    await db.insert(help).values({ id: HELP_ID, description: description || "" });
  } else {
    await db.update(help).set({ description: description || "", updatedAt: new Date() }).where(eq(help.id, HELP_ID));
  }
  return success(null);
}
