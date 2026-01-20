import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authUser, userProfile } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth/server";
import { isValidName } from "@/lib/auth/validate";
import { randomUUID } from "crypto";
import { getGoogleIdFromUserId } from "@/lib/auth/social-utils";
import { normalizeUploadsSrc } from "@/lib/utils";
import { successResponse, errorResponse } from "@/lib/api-response";

// Obtém os dados do perfil do usuário logado
export async function GET() {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Busca os dados do perfil do usuário no banco de dados
    const findUserProfile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, user.id),
    });

    // Busca a imagem do usuário diretamente do banco de dados
    const userData = await db
      .select({ image: authUser.image })
      .from(authUser)
      .where(eq(authUser.id, user.id))
      .limit(1);
    const storedImage = userData[0]?.image || null;
    const normalizedImage = storedImage
      ? normalizeUploadsSrc(storedImage)
      : null;

    if (storedImage && normalizedImage !== storedImage) {
      await db
        .update(authUser)
        .set({ image: normalizedImage })
        .where(eq(authUser.id, user.id));
    }

    // ID do usuário no Google
    const { googleId } = await getGoogleIdFromUserId(user.id);

    // Retorna os dados do perfil do usuário
    return successResponse({
      user: { ...user, image: normalizedImage },
      userProfile: findUserProfile ?? {},
      googleId,
    });
  } catch (error) {
    console.error(
      "❌ [API_USER_PROFILE] Erro ao obter os dados do perfil do usuário:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}

// Altera os dados do perfil do usuário logado
export async function PUT(req: NextRequest) {
  try {
    // Verifica se o usuário está logado e obtém os dados do usuário
    const user = await getAuthUser();
    if (!user) return errorResponse("Usuário não logado.", 401);

    // Obtem os dados recebidos
    const body = await req.json();
    const name = (body.name as string)?.trim();
    const phone = (body.phone as string)?.trim();
    const company = (body.company as string)?.trim();
    const genre = body.genre as string;
    const role = body.role as string;
    const location = body.location as string;
    const team = body.team as string;

    // Validação básica dos campos
    if (!name) {
      return errorResponse("O nome é obrigatório.", 400);
    }

    if (!isValidName(name)) {
      return errorResponse(
        "O nome precisa ser completo e conter apenas letras.",
        400,
        { field: "name" },
      );
    }

    // Atualiza o nome do usuário no banco de dados
    const [updateUser] = await db
      .update(authUser)
      .set({ name })
      .where(eq(authUser.id, user.id))
      .returning();
    if (!updateUser) {
      return errorResponse(
        "Ocorreu um erro ao alterar o nome do usuário.",
        500,
      );
    }

    // Verifica se o perfil do usuário já existe no banco de dados pelo ID do usuário
    const findUserProfile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, user.id),
    });

    // Se o perfil do usuário ainda não existir, cadastra os dados de perfil do usuário
    if (!findUserProfile) {
      // Insere o perfil do usuário no banco de dados
      const [insertUserProfile] = await db
        .insert(userProfile)
        .values({
          id: randomUUID(),
          userId: user.id,
          genre,
          phone,
          role,
          team,
          company,
          location,
        })
        .returning();
      if (!insertUserProfile)
        return errorResponse(
          "Ocorreu um erro ao salvar os dados de perfil do usuário no banco de dados.",
          500,
        );

      // Retorna a resposta com sucesso
      return successResponse(null, "Dados atualizados com sucesso!");
    }

    // Se o perfil do usuário existir, atualiza os dados de perfil do usuário
    const [updateUserProfile] = await db
      .update(userProfile)
      .set({ phone, company, genre, role, location, team })
      .where(eq(userProfile.userId, user.id))
      .returning();
    if (!updateUserProfile) {
      return errorResponse(
        "Ocorreu um erro ao alterar os dados de perfil do usuário.",
        500,
      );
    }

    // Retorna a resposta com sucesso
    return successResponse(null, "Dados atualizados com sucesso!");
  } catch (error) {
    console.error(
      "❌ [API_USER_PROFILE] Erro ao alterar dados do perfil do usuário:",
      { error },
    );
    return errorResponse("Erro inesperado. Tente novamente.", 500);
  }
}
