import { db } from "@silo/database";
import { contact, productContact } from "@silo/database/schema";
import { eq, and, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { deleteUploadFile, isSafeFilename, isUploadKind } from "../infra/uploads.js";

type ContactServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ContactServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
};

const success = <T>(data: T): ContactServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ContactServiceError, "ok" | "error" | "status">,
): ContactServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

export async function deleteContactImageFile(imageUrl: string): Promise<void> {
  const cleanImageUrl = imageUrl.split(/[?#]/, 1)[0];
  const filePath = cleanImageUrl.startsWith("/uploads/") ? cleanImageUrl.slice("/uploads/".length) : "";
  if (!filePath) return;

  const parts = filePath.split("/");
  const kind = parts[0];
  const filename = parts.slice(1).join("/");
  if (kind && filename && isUploadKind(kind) && isSafeFilename(filename)) {
    await deleteUploadFile(kind, filename);
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
  if (existing.length > 0) return failure("Este email já está em uso", 400, { field: "email" });

  const id = randomUUID();
  await db.insert(contact).values({ id, name: data.name, role: data.role, team: data.team, email: data.email, phone: data.phone ?? null, image: data.imageUrl ?? null, active: data.active });
  return success({ id });
}

export async function updateContact(data: { id: string; name: string; role: string; team: string; email: string; phone?: string | null; imageUrl?: string | null; active: boolean; removeImage?: boolean }) {
  const existing = await db.select().from(contact).where(eq(contact.id, data.id)).limit(1);
  if (existing.length === 0) return failure("Contato não encontrado.", 404);

  const curr = existing[0];
  if (data.email !== curr.email) {
    const emailCheck = await db.select().from(contact).where(and(eq(contact.email, data.email), ne(contact.id, data.id))).limit(1);
    if (emailCheck.length > 0) return failure("Este email já está em uso", 400, { field: "email" });
  }

  let imagePath = curr.image;
  if (data.imageUrl) imagePath = data.imageUrl;
  if (data.removeImage && curr.image) {
    imagePath = null;
    await deleteContactImageFile(curr.image);
  }

  await db.update(contact).set({ name: data.name, role: data.role, team: data.team, email: data.email, phone: data.phone ?? null, image: imagePath, active: data.active, updatedAt: new Date() }).where(eq(contact.id, data.id));
  return success(null);
}

export async function deleteContact(id: string) {
  const existing = await db.select().from(contact).where(eq(contact.id, id)).limit(1);
  if (existing.length === 0) return failure("Contato não encontrado.", 404);

  const curr = existing[0];
  await db.delete(productContact).where(eq(productContact.contactId, id));
  await db.delete(contact).where(eq(contact.id, id));

  if (curr.image) await deleteContactImageFile(curr.image);
  return success(null);
}
