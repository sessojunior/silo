import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { contact, productContact } from "@/lib/db/schema";
import { requireAdminAuthUser } from "@/lib/auth/server";
import { requestUtils } from "@/lib/config";
import {
  deleteUploadFile,
  isSafeFilename,
  isUploadKind,
} from "@/lib/localUploads";
import { successResponse, errorResponse } from "@/lib/api-response";

// GET - Listar contatos com filtros
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all"; // all, active, inactive

    // Query ordenada alfabeticamente por nome
    const contacts = await db.select().from(contact).orderBy(contact.name);

    // Aplicar filtros em JavaScript por simplicidade
    let filteredContacts = contacts;

    if (search) {
      filteredContacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.role.toLowerCase().includes(search.toLowerCase()) ||
          c.team.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (status === "active") {
      filteredContacts = filteredContacts.filter((c) => c.active);
    } else if (status === "inactive") {
      filteredContacts = filteredContacts.filter((c) => !c.active);
    }

    return successResponse({
      items: filteredContacts,
      total: filteredContacts.length,
    });
  } catch (error) {
    console.error("❌ [API_CONTACTS] Erro ao listar contatos:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// POST - Criar novo contato
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const formData = await req.formData();
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const team = formData.get("team") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string | null;
    const imageUrl = formData.get("imageUrl") as string | null;
    const active = formData.get("active") === "true";

    // Validações
    if (!name || name.trim().length < 2) {
      return errorResponse("Nome deve ter pelo menos 2 caracteres", 400);
    }
    if (!role || role.trim().length < 2) {
      return errorResponse("Função deve ter pelo menos 2 caracteres", 400);
    }
    if (!team || team.trim().length < 2) {
      return errorResponse("Equipe deve ter pelo menos 2 caracteres", 400);
    }
    if (!email || !email.includes("@")) {
      return errorResponse("Email inválido", 400);
    }

    // Verificar email único
    const existingContact = await db
      .select()
      .from(contact)
      .where(eq(contact.email, email));
    if (existingContact.length > 0) {
      return errorResponse("Este email já está em uso", 400);
    }

    let imagePath: string | null = null;

    // Definir imagem a partir de URL se fornecida
    if (imageUrl) {
      imagePath = imageUrl;
    }

    // Criar contato
    const contactId = randomUUID();
    await db.insert(contact).values({
      id: contactId,
      name: name.trim(),
      role: role.trim(),
      team: team.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      image: imagePath,
      active,
    });

    return successResponse(
      { id: contactId },
      "Contato criado com sucesso",
      201,
    );
  } catch (error) {
    console.error("❌ [API_CONTACTS] Erro ao criar contato:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// PUT - Editar contato
export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const formData = await req.formData();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;
    const team = formData.get("team") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string | null;
    const imageUrl = formData.get("imageUrl") as string | null;
    const active = formData.get("active") === "true";
    const removeImage = formData.get("removeImage") === "true";

    if (!id) {
      return errorResponse("ID do contato é obrigatório", 400);
    }

    // Verificar se contato existe
    const existingContacts = await db
      .select()
      .from(contact)
      .where(eq(contact.id, id));
    if (existingContacts.length === 0) {
      return errorResponse("Contato não encontrado", 404);
    }

    const existingContact = existingContacts[0];

    // Validações
    if (!name || name.trim().length < 2) {
      return errorResponse("Nome deve ter pelo menos 2 caracteres", 400);
    }
    if (!role || role.trim().length < 2) {
      return errorResponse("Função deve ter pelo menos 2 caracteres", 400);
    }
    if (!team || team.trim().length < 2) {
      return errorResponse("Equipe deve ter pelo menos 2 caracteres", 400);
    }
    if (!email || !email.includes("@")) {
      return errorResponse("Email inválido", 400);
    }

    // Verificar email único (exceto o próprio contato)
    if (email !== existingContact.email) {
      const emailCheck = await db
        .select()
        .from(contact)
        .where(eq(contact.email, email));
      if (emailCheck.length > 0) {
        return errorResponse("Este email já está em uso", 400);
      }
    }

    let imagePath = existingContact.image;

    // Se nova imagem via URL
    if (imageUrl) {
      imagePath = imageUrl;
    }

    // Remover imagem se solicitado
    if (removeImage && existingContact.image) {
      imagePath = null;

      // Remover arquivo do disco também
      try {
        if (requestUtils.isFileServerUrl(existingContact.image)) {
          const filePath = requestUtils.extractFilePath(existingContact.image);
          if (filePath) {
            const [kind, ...rest] = filePath.split("/");
            const filename = rest.join("/");
            if (
              kind &&
              filename &&
              isUploadKind(kind) &&
              isSafeFilename(filename)
            ) {
              await deleteUploadFile(kind, filename);
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ [API_CONTACTS] Erro ao remover arquivo antigo:", {
          error,
        });
      }
    }

    // Atualizar contato
    await db
      .update(contact)
      .set({
        name: name.trim(),
        role: role.trim(),
        team: team.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        image: imagePath,
        active,
        updatedAt: new Date(),
      })
      .where(eq(contact.id, id));

    return successResponse(null, "Contato atualizado com sucesso");
  } catch (error) {
    console.error("❌ [API_CONTACTS] Erro ao atualizar contato:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}

// DELETE - Excluir contato
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const { id } = await req.json();

    if (!id) {
      return errorResponse("ID do contato é obrigatório", 400);
    }

    // Verificar se contato existe e pegar imagem para deletar
    const existingContacts = await db
      .select()
      .from(contact)
      .where(eq(contact.id, id));
    if (existingContacts.length === 0) {
      return errorResponse("Contato não encontrado", 404);
    }

    const contactToDelete = existingContacts[0];

    // Remover associações primeiro (tabela productContact)
    await db.delete(productContact).where(eq(productContact.contactId, id));

    // Remover contato
    await db.delete(contact).where(eq(contact.id, id));

    // Remover imagem se existir
    if (contactToDelete.image) {
      try {
        if (requestUtils.isFileServerUrl(contactToDelete.image)) {
          const filePath = requestUtils.extractFilePath(contactToDelete.image);
          if (filePath) {
            const [kind, ...rest] = filePath.split("/");
            const filename = rest.join("/");
            if (
              kind &&
              filename &&
              isUploadKind(kind) &&
              isSafeFilename(filename)
            ) {
              await deleteUploadFile(kind, filename);
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ [API_CONTACTS] Erro ao remover imagem do contato:", {
          error,
        });
      }
    }

    return successResponse(null, "Contato excluído com sucesso");
  } catch (error) {
    console.error("❌ [API_CONTACTS] Erro ao excluir contato:", { error });
    return errorResponse("Erro interno do servidor", 500);
  }
}
