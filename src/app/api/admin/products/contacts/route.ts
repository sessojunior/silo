import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { requirePermissionAuthUser } from "@/lib/permissions";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { productContact, contact } from "@/lib/db/schema";

// GET - Listar contatos associados ao produto
export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("contacts", "list");
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return errorResponse("ProductId é obrigatório", 400);
    }

    // Query com JOIN para pegar dados completos dos contatos ATIVOS
    const contactsWithDetails = await db
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
      .where(
        and(eq(productContact.productId, productId), eq(contact.active, true)),
      )
      .orderBy(productContact.createdAt);

    return successResponse({
      contacts: contactsWithDetails,
      total: contactsWithDetails.length,
    });
  } catch (error) {
    console.error("Erro ao buscar contatos do produto:", error);
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST - Associar contatos ao produto
export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("contacts", "create");
    if (!authResult.ok) return authResult.response;

    const { productId, contactIds } = await req.json();

    if (!productId || !contactIds || !Array.isArray(contactIds)) {
      return errorResponse("ProductId e contactIds são obrigatórios", 400);
    }

    // Remover associações existentes
    await db
      .delete(productContact)
      .where(eq(productContact.productId, productId));

    // Criar novas associações
    if (contactIds.length > 0) {
      const associations = contactIds.map((contactId: string) => ({
        id: randomUUID(),
        productId,
        contactId,
      }));

      await db.insert(productContact).values(associations);
    }

    return successResponse(
      null,
      `${contactIds.length} contatos associados com sucesso`,
    );
  } catch (error) {
    console.error("Erro ao associar contatos:", error);
    return errorResponse("Erro interno do servidor", 500);
  }
}

// DELETE - Remover associação específica
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requirePermissionAuthUser("contacts", "delete");
    if (!authResult.ok) return authResult.response;

    const { associationId } = await req.json();

    if (!associationId) {
      return errorResponse("AssociationId é obrigatório", 400);
    }

    await db.delete(productContact).where(eq(productContact.id, associationId));

    return successResponse(null, "Associação removida com sucesso");
  } catch (error) {
    console.error("Erro ao remover associação de contato:", error);
    return errorResponse("Erro interno do servidor", 500);
  }
}
