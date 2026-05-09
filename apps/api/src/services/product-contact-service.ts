import { db } from "@silo/database";
import { contact, productContact } from "@silo/database/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type ProductContactServiceSuccess<T> = {
  ok: true;
  data: T;
};

type ProductContactServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
};

const success = <T>(data: T): ProductContactServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<ProductContactServiceError, "ok" | "error" | "status">,
): ProductContactServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

type ProductContactListItem = {
  id: string;
  name: string | null;
  role: string | null;
  team: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  active: boolean;
  associationId: string;
  createdAt: Date;
};

export async function listProductContacts(productId: string): Promise<ProductContactServiceSuccess<{ contacts: ProductContactListItem[] }>> {
  const contacts = await db
    .select({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      team: contact.team,
      email: contact.email,
      phone: contact.phone,
      image: contact.image,
      active: contact.active,
      associationId: productContact.id,
      createdAt: productContact.createdAt,
    })
    .from(productContact)
    .innerJoin(contact, eq(productContact.contactId, contact.id))
    .where(and(eq(productContact.productId, productId), eq(contact.active, true)))
    .orderBy(productContact.createdAt);

  return success({ contacts });
}

export async function replaceProductContacts(data: {
  productId: string;
  contactIds: string[];
}): Promise<ProductContactServiceSuccess<null>> {
  const contactIds = Array.from(new Set(data.contactIds));

  await db.delete(productContact).where(eq(productContact.productId, data.productId));

  if (contactIds.length > 0) {
    await db.insert(productContact).values(
      contactIds.map((contactId) => ({
        id: randomUUID(),
        productId: data.productId,
        contactId,
      })),
    );
  }

  return success(null);
}

export async function deleteProductContactAssociation(associationId: string): Promise<ProductContactServiceSuccess<null> | ProductContactServiceError> {
  const [association] = await db
    .select({ id: productContact.id })
    .from(productContact)
    .where(eq(productContact.id, associationId))
    .limit(1);

  if (!association) {
    return failure("Associação não encontrada.", 404);
  }

  await db.delete(productContact).where(eq(productContact.id, associationId));

  return success(null);
}