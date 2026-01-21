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
import {
  parseRequestFormData,
  parseRequestJson,
  parseRequestQuery,
  successResponse,
  errorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { isValidEmail } from "@/lib/auth/validate";

const ContactsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "active", "inactive"]).optional(),
});

const toTrimmedStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toTrimmedStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const ContactBaseFormSchema = z.object({
  name: z.preprocess(
    (v) => toTrimmedStringOrUndefined(v),
    z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  ),
  role: z.preprocess(
    (v) => toTrimmedStringOrUndefined(v),
    z.string().min(2, "Função deve ter pelo menos 2 caracteres"),
  ),
  team: z.preprocess(
    (v) => toTrimmedStringOrUndefined(v),
    z.string().min(2, "Equipe deve ter pelo menos 2 caracteres"),
  ),
  email: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      return v.trim().toLowerCase();
    },
    z
      .string()
      .email("Email inválido")
      .refine(isValidEmail, "Email inválido"),
  ),
  phone: z.preprocess((v) => toTrimmedStringOrNull(v), z.string().nullable()),
  imageUrl: z.preprocess((v) => toTrimmedStringOrNull(v), z.string().nullable()),
  active: z.preprocess((v) => toBoolean(v), z.boolean()),
});

const CreateContactFormSchema = ContactBaseFormSchema;

const UpdateContactFormSchema = ContactBaseFormSchema.extend({
  id: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().uuid("ID do contato é obrigatório"),
  ),
  removeImage: z.preprocess((v) => toBoolean(v) ?? false, z.boolean()),
});

const DeleteContactSchema = z.object({
  id: z.string().uuid("ID do contato é obrigatório"),
});

// GET - Listar contatos com filtros
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuthUser();
    if (!authResult.ok) return authResult.response;

    const parsedQuery = parseRequestQuery(req, ContactsQuerySchema);
    if (!parsedQuery.ok) return parsedQuery.response;
    const search = parsedQuery.data.search ?? "";
    const status = parsedQuery.data.status ?? "all";

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

    const parsedBody = await parseRequestFormData(req, CreateContactFormSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { name, role, team, email, phone, imageUrl, active } = parsedBody.data;

    // Verificar email único
    const existingContact = await db
      .select()
      .from(contact)
      .where(eq(contact.email, email));
    if (existingContact.length > 0) {
      return errorResponse("Este email já está em uso", 400, { field: "email" });
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
      name,
      role,
      team,
      email,
      phone,
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

    const parsedBody = await parseRequestFormData(req, UpdateContactFormSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { id, name, role, team, email, phone, imageUrl, active, removeImage } =
      parsedBody.data;

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
        return errorResponse("Este email já está em uso", 400, { field: "email" });
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
        name,
        role,
        team,
        email,
        phone,
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

    const parsedBody = await parseRequestJson(req, DeleteContactSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { id } = parsedBody.data;

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
