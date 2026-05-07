import { db } from "@silo/database";
import { contact, productContact } from "@silo/database/schema";
import { eq, and, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type UploadKind = "general" | "avatars" | "contacts" | "incidents" | "problems" | "solutions" | "manual" | "help" | "projects";

const uploadKinds: ReadonlyArray<UploadKind> = ["general", "avatars", "contacts", "incidents", "problems", "solutions", "manual", "help", "projects"];

export const isUploadKind = (value: string): value is UploadKind => uploadKinds.includes(value as UploadKind);

export const isSafeFilename = (filename: string): boolean => {
  if (filename.includes("..")) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  return path.basename(filename) === filename;
};

export async function deleteContactImageFile(imageUrl: string): Promise<void> {
  try {
    const uploadsDir = path.join(process.cwd(), "public");
    const filePath = imageUrl.startsWith("/uploads/") ? imageUrl.slice(1) : null;
    if (!filePath) return;
    const parts = filePath.replace("uploads/", "").split("/");
    const kind = parts[0];
    const filename = parts.slice(1).join("/");
    if (kind && filename && isUploadKind(kind) && isSafeFilename(filename)) {
      const fullPath = path.join(process.cwd(), "uploads", kind, filename);
      await fs.unlink(fullPath).catch(() => undefined);
    }
    void uploadsDir;
  } catch {
    // noop
  }
}

export async function listContacts(opts: { search?: string; status?: string }) {
  const { search, status } = opts;
  const contacts = await db.select().from(contact).orderBy(contact.name);

  let filtered = contacts;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.role.toLowerCase().includes(s) ||
        c.team.toLowerCase().includes(s),
    );
  }
  if (status === "active") filtered = filtered.filter((c) => c.active);
  else if (status === "inactive") filtered = filtered.filter((c) => !c.active);

  return { items: filtered, total: filtered.length };
}

export async function createContact(data: { name: string; role: string; team: string; email: string; phone?: string | null; imageUrl?: string | null; active: boolean }) {
  const existing = await db.select().from(contact).where(eq(contact.email, data.email));
  if (existing.length > 0) return { error: "Este email já está em uso", field: "email" };

  const id = randomUUID();
  await db.insert(contact).values({ id, name: data.name, role: data.role, team: data.team, email: data.email, phone: data.phone ?? null, image: data.imageUrl ?? null, active: data.active });
  return { id };
}

export async function updateContact(data: { id: string; name: string; role: string; team: string; email: string; phone?: string | null; imageUrl?: string | null; active: boolean; removeImage?: boolean }) {
  const existing = await db.select().from(contact).where(eq(contact.id, data.id)).limit(1);
  if (existing.length === 0) return { error: "Contato não encontrado.", status: 404 };

  const curr = existing[0];
  if (data.email !== curr.email) {
    const emailCheck = await db.select().from(contact).where(and(eq(contact.email, data.email), ne(contact.id, data.id))).limit(1);
    if (emailCheck.length > 0) return { error: "Este email já está em uso", field: "email" };
  }

  let imagePath = curr.image;
  if (data.imageUrl) imagePath = data.imageUrl;
  if (data.removeImage && curr.image) {
    imagePath = null;
    await deleteContactImageFile(curr.image);
  }

  await db.update(contact).set({ name: data.name, role: data.role, team: data.team, email: data.email, phone: data.phone ?? null, image: imagePath, active: data.active, updatedAt: new Date() }).where(eq(contact.id, data.id));
  return { ok: true };
}

export async function deleteContact(id: string) {
  const existing = await db.select().from(contact).where(eq(contact.id, id)).limit(1);
  if (existing.length === 0) return { error: "Contato não encontrado.", status: 404 };

  const curr = existing[0];
  await db.delete(productContact).where(eq(productContact.contactId, id));
  await db.delete(contact).where(eq(contact.id, id));

  if (curr.image) await deleteContactImageFile(curr.image);
  return { ok: true };
}
