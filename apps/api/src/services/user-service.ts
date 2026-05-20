import { db } from "@silo/database";
import {
  authUser,
  group,
  userGroup,
  authAccount,
  authSession,
  userPreferences,
  userProfile,
  chatUserPresence,
  chatMessage,
} from "@silo/database/schema";
import { eq, desc, ilike, and, inArray, ne, or } from "drizzle-orm";
import { randomInt, randomUUID } from "crypto";
import { hashPassword } from "@silo/engine/auth/hash";
import { sendEmail } from "../infra/send-email.js";
import { auth } from "../auth/setup.js";
import { toHeaders } from "../lib/request-headers.js";
import { getPermissions, getUserGroups, isAdmin } from "../middleware/permissions.js";
import type { IncomingHttpHeaders } from "http";
import { authVerification } from "@silo/database/schema";
import { deleteUploadFile, isSafeFilename, isUploadKind, storeBufferAsWebp } from "../infra/uploads.js";

const EMAIL_CHANGE_OTP_TTL_SECONDS = 5 * 60;
const EMAIL_CHANGE_OTP_LENGTH = 6;

interface UserGroupInput { groupId: string; }

type UserServiceSuccess<T> = {
  ok: true;
  data: T;
};

type UserServiceError = {
  ok: false;
  error: string;
  status?: number;
  field?: string;
  data?: unknown;
};

const success = <T>(data: T): UserServiceSuccess<T> => ({
  ok: true,
  data,
});

const failure = (
  error: string,
  status?: number,
  extra?: Omit<UserServiceError, "ok" | "error" | "status">,
): UserServiceError => ({
  ok: false,
  error,
  ...(typeof status === "number" ? { status } : {}),
  ...(extra ?? {}),
});

export async function listUsers(opts: { search?: string; status?: string; groupId?: string }) {
  const { search, status, groupId } = opts;
  const conditions = [];
  if (search) conditions.push(ilike(authUser.name, `%${search}%`));
  if (status === "active") conditions.push(eq(authUser.isActive, true));
  else if (status === "inactive") conditions.push(eq(authUser.isActive, false));

  if (groupId) {
    const usersInGroup = await db.select({ userId: userGroup.userId }).from(userGroup).where(eq(userGroup.groupId, groupId));
    const userIds = usersInGroup.map((u) => u.userId);
    if (userIds.length === 0) return { items: [], total: 0 };
    conditions.push(inArray(authUser.id, userIds));
  }

  const users = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image, emailVerified: authUser.emailVerified, isActive: authUser.isActive, lastLogin: authUser.lastLogin, createdAt: authUser.createdAt })
    .from(authUser)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(authUser.createdAt));

  const usersWithGroups = [];
  for (const user of users) {
    const userGroups = await db
      .select({ groupId: group.id, groupName: group.name, groupIcon: group.icon, groupColor: group.color })
      .from(userGroup)
      .innerJoin(group, eq(group.id, userGroup.groupId))
      .where(eq(userGroup.userId, user.id));
    const primaryGroup = userGroups[0];
    const account = await db.select().from(authAccount).where(and(eq(authAccount.userId, user.id), eq(authAccount.providerId, "credential"))).limit(1);
    const hasPassword = account.length > 0 && !!account[0].password;
    usersWithGroups.push({ ...user, groupId: primaryGroup?.groupId || null, groupName: primaryGroup?.groupName || null, groupIcon: primaryGroup?.groupIcon || null, groupColor: primaryGroup?.groupColor || null, groups: userGroups, needsPasswordSetup: !hasPassword });
  }
  return { items: usersWithGroups, total: usersWithGroups.length };
}

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  groups?: UserGroupInput[];
  groupId?: string;
  isActive?: boolean;
}, headers: IncomingHttpHeaders) {
  const userGroups: UserGroupInput[] = data.groups || (data.groupId ? [{ groupId: data.groupId }] : []);
  if (userGroups.length === 0) return failure("Pelo menos um grupo é obrigatório.", 400, { field: "groups" });

  const existingUser = await db.select().from(authUser).where(eq(authUser.email, data.email)).limit(1);
  if (existingUser.length > 0) return failure("Já existe um usuário com este email.", 400, { field: "email" });

  const groupIds = userGroups.map((ug) => ug.groupId);
  const existingGroups = await db.select().from(group).where(inArray(group.id, groupIds));
  if (existingGroups.length !== groupIds.length) {
    const foundIds = existingGroups.map((g) => g.id);
    const missing = groupIds.filter((id) => !foundIds.includes(id));
    return failure(`Grupos não encontrados: ${missing.join(", ")}`, 400, { field: "groups" });
  }

  const userId = randomUUID();
  let hashedPassword: string | null = null;
  let needsPasswordSetup = false;

  if (data.password) hashedPassword = await hashPassword(data.password);
  else needsPasswordSetup = true;

  const newUser = { id: userId, name: data.name.trim(), email: data.email, emailVerified: false, image: null, isActive: data.isActive !== undefined ? data.isActive : true, createdAt: new Date(), updatedAt: new Date() };

  await db.insert(authUser).values(newUser);
  if (hashedPassword) {
    await db.insert(authAccount).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential", password: hashedPassword, createdAt: new Date(), updatedAt: new Date() });
  }
  await db.insert(userGroup).values(userGroups.map((ug) => ({ userId, groupId: ug.groupId })));

  if (needsPasswordSetup) {
    try {
      const authApi = auth.api as {
        forgetPassword: (params: {
          body: { email: string };
          headers: Headers;
        }) => Promise<unknown>;
      };
      await authApi.forgetPassword({ body: { email: newUser.email }, headers: toHeaders(headers) });
    } catch (err) {
      console.error("❌ [USER_SERVICE] Erro ao enviar email de setup de senha:", err);
    }
  }

  return success(newUser);
}

export async function updateUser(data: {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  isActive?: boolean;
  groups?: UserGroupInput[];
  groupId?: string;
}) {
  const existing = await db.select().from(authUser).where(eq(authUser.id, data.id)).limit(1);
  if (existing.length === 0) return failure("Usuário não encontrado.", 404);

  const normalizedEmail = data.email.trim().toLowerCase();
  const emailConflict = await db.select({ id: authUser.id }).from(authUser).where(and(eq(authUser.email, normalizedEmail), ne(authUser.id, data.id))).limit(1);
  if (emailConflict.length > 0) return failure("Já existe um usuário com este email.", 400, { field: "email" });

  const userGroups: UserGroupInput[] = data.groups || (data.groupId ? [{ groupId: data.groupId }] : []);
  if (userGroups.length === 0) return failure("Pelo menos um grupo é obrigatório.", 400, { field: "groups" });

  const groupIds = userGroups.map((ug) => ug.groupId);
  const existingGroups = await db.select().from(group).where(inArray(group.id, groupIds));
  if (existingGroups.length !== groupIds.length) {
    const foundIds = existingGroups.map((g) => g.id);
    const missing = groupIds.filter((id) => !foundIds.includes(id));
    return failure(`Grupos não encontrados: ${missing.join(", ")}`, 400, { field: "groups" });
  }

  const updateData = {
    name: data.name.trim(),
    email: normalizedEmail,
    updatedAt: new Date(),
    ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
  };

  await db.transaction(async (tx) => {
    await tx.update(authUser).set(updateData).where(eq(authUser.id, data.id));
    await tx.delete(userGroup).where(eq(userGroup.userId, data.id));
    await tx.insert(userGroup).values(userGroups.map((ug) => ({ userId: data.id, groupId: ug.groupId })));
  });

  return success({ id: data.id, name: updateData.name, email: updateData.email });
}

export async function deleteUser(id: string) {
  const existing = await db.select().from(authUser).where(eq(authUser.id, id)).limit(1);
  if (existing.length === 0) return failure("Usuário não encontrado.", 404);

  const userGroupsQuery = await db.select({ role: group.role }).from(userGroup).innerJoin(group, eq(group.id, userGroup.groupId)).where(eq(userGroup.userId, id));
  const isAdminUser = userGroupsQuery.some((g) => g.role === "admin");
  if (isAdminUser) {
    const adminGroups = await db.select({ id: group.id }).from(group).where(eq(group.role, "admin"));
    const adminGroupIds = adminGroups.map((g) => g.id);
    if (adminGroupIds.length > 0) {
      const adminUsers = await db.select({ userId: userGroup.userId }).from(userGroup).where(inArray(userGroup.groupId, adminGroupIds));
      const uniqueAdminUsers = new Set(adminUsers.map((u) => u.userId));
      if (uniqueAdminUsers.size <= 1) return failure("Não é possível excluir o último administrador do sistema.", 400);
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(chatMessage).where(or(eq(chatMessage.senderUserId, id), eq(chatMessage.receiverUserId, id)));
    await tx.delete(chatUserPresence).where(eq(chatUserPresence.userId, id));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, id));
    await tx.delete(userProfile).where(eq(userProfile.userId, id));
    await tx.delete(userGroup).where(eq(userGroup.userId, id));
    await tx.delete(authAccount).where(eq(authAccount.userId, id));
    await tx.delete(authSession).where(eq(authSession.userId, id));
    await tx.delete(authUser).where(eq(authUser.id, id));
  });

  return success(null);
}

export async function resendPasswordSetup(userId: string) {
  const targetUser = await db.select().from(authUser).where(eq(authUser.id, userId)).limit(1);
  if (targetUser.length === 0) return failure("Usuário não encontrado.", 404);

  const account = await db
    .select()
    .from(authAccount)
    .where(and(eq(authAccount.userId, userId), eq(authAccount.providerId, "credential")))
    .limit(1);

  if (account.length > 0 && account[0].password) {
    return failure("Este usuário já possui senha definida.", 400);
  }

  await auth.api.sendVerificationOTP({
    body: { email: targetUser[0].email, type: "forget-password" },
  });

  return success(null);
}

export async function getCurrentUserProfile(userId: string) {
  const userRows = await db
    .select({ id: authUser.id, name: authUser.name, email: authUser.email, image: authUser.image })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (userRows.length === 0) return failure("Usuário não encontrado", 404);

  const userProfileRow = await db.query.userProfile.findFirst({ where: eq(userProfile.userId, userId) });
  const groups = await getUserGroups(userId);
  const permissions = await getPermissions(userId, groups);
  const permSummary: Record<string, string[]> = {};

  for (const [resource, actions] of Object.entries(permissions)) {
    permSummary[resource] = [...actions];
  }

  const googleAccount = await db.query.authAccount.findFirst({
    where: and(eq(authAccount.userId, userId), eq(authAccount.providerId, "google")),
  });

  return success({
    user: userRows[0],
    userProfile: userProfileRow ?? {},
    googleId: googleAccount?.accountId ?? null,
    groups,
    permissions: permSummary,
    isAdmin: isAdmin(groups),
  });
}

export async function updateCurrentUserProfile(userId: string, data: {
  name: string;
  phone: string;
  company: string;
  genre: string;
  role: string;
  location: string;
  team: string;
}) {
  const [updatedUser] = await db
    .update(authUser)
    .set({ name: data.name })
    .where(eq(authUser.id, userId))
    .returning();

  if (!updatedUser) return failure("Erro ao atualizar nome", 500);

  const existingProfile = await db.query.userProfile.findFirst({ where: eq(userProfile.userId, userId) });
  if (!existingProfile) {
    await db.insert(userProfile).values({
      id: randomUUID(),
      userId,
      genre: data.genre,
      phone: data.phone,
      role: data.role,
      team: data.team,
      company: data.company,
      location: data.location,
    });
  } else {
    await db
      .update(userProfile)
      .set({
        phone: data.phone,
        company: data.company,
        genre: data.genre,
        role: data.role,
        location: data.location,
        team: data.team,
      })
      .where(eq(userProfile.userId, userId));
  }

  return success(null);
}

export async function getCurrentUserPreferences(userId: string) {
  const prefs = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  return success({ userPreferences: prefs ?? {} });
}

export async function updateCurrentUserPreferences(userId: string, chatEnabled: boolean) {
  const existing = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  if (!existing) {
    await db.insert(userPreferences).values({ id: randomUUID(), userId, chatEnabled });
  } else {
    await db.update(userPreferences).set({ chatEnabled }).where(eq(userPreferences.userId, userId));
  }

  return success(null);
}

export async function updateCurrentUserProfileImageUrl(userId: string, imageUrl: string) {
  const [updatedUser] = await db
    .update(authUser)
    .set({ image: imageUrl })
    .where(eq(authUser.id, userId))
    .returning();

  if (!updatedUser) return failure("Erro ao atualizar URL da imagem", 500);

  return success({ imageUrl });
}

export async function updateCurrentUserPassword(userId: string, password: string) {
  const userRows = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (userRows.length === 0) return failure("Usuário não encontrado.", 404);

  const hashedPassword = await hashPassword(password);
  const updatedAccount = await db
    .update(authAccount)
    .set({ password: hashedPassword })
    .where(and(eq(authAccount.userId, userId), eq(authAccount.providerId, "credential")))
    .returning();

  if (updatedAccount.length === 0) {
    await db.insert(authAccount).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const userEmail = userRows[0].email;
  if (userEmail) {
    const emailResult = await sendEmail({
      to: userEmail,
      subject: "Senha alterada",
      text: "Sua senha no Silo foi alterada com sucesso.",
    });

    if ("error" in emailResult) {
      console.error("❌ [USER_SERVICE] Erro ao notificar alteração de senha:", emailResult.error);
    }
  }

  return success(null);
}

export async function updateCurrentUserEmail(userId: string, newEmail: string) {
  const userRows = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (userRows.length === 0) return failure("Usuário não encontrado", 404);

  const currentEmail = userRows[0].email;
  if (currentEmail === newEmail) {
    return failure("O e-mail informado é o mesmo que o atual.", 400, { field: "email" });
  }

  const emailConflict = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(and(eq(authUser.email, newEmail), ne(authUser.id, userId)))
    .limit(1);

  if (emailConflict.length > 0) {
    return failure("Já existe um usuário com este email.", 400, { field: "email" });
  }

  const updatedUser = await db
    .update(authUser)
    .set({ email: newEmail })
    .where(eq(authUser.id, userId))
    .returning();

  if (updatedUser.length === 0) return failure("Erro ao atualizar e-mail", 500);

  if (currentEmail) {
    await sendEmail({
      to: currentEmail,
      subject: `E-mail alterado para ${newEmail}`,
      text: `O seu e-mail no Silo foi alterado de ${currentEmail} para ${newEmail}.`,
    });
  }

  await sendEmail({
    to: newEmail,
    subject: `E-mail alterado para ${newEmail}`,
    text: `O seu e-mail no Silo foi alterado de ${currentEmail} para ${newEmail}.`,
  });

  return success({ email: newEmail });
}

export async function requestCurrentUserEmailChange(userId: string, newEmail: string) {
  const userRows = await db
    .select({ email: authUser.email })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (userRows.length === 0) return failure("Usuário não encontrado", 404);

  const currentEmail = userRows[0].email;
  if (currentEmail === newEmail) {
    return failure("O e-mail informado é o mesmo que o atual.", 400, { field: "email" });
  }

  const emailConflict = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(and(eq(authUser.email, newEmail), ne(authUser.id, userId)))
    .limit(1);

  if (emailConflict.length > 0) {
    return failure("Este e-mail já está sendo usado.", 400, { field: "email" });
  }

  const otp = String(randomInt(0, 10 ** EMAIL_CHANGE_OTP_LENGTH)).padStart(EMAIL_CHANGE_OTP_LENGTH, "0");
  const identifier = `email-change-otp-${userId}-${newEmail}`;
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_OTP_TTL_SECONDS * 1000);

  await db.delete(authVerification).where(eq(authVerification.identifier, identifier));
  await db.insert(authVerification).values({
    id: randomUUID(),
    identifier,
    value: `${otp}:0`,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const emailResult = await sendEmail({
    to: newEmail,
    subject: "Código de verificação para troca de e-mail",
    text: `Seu código de verificação é ${otp}.`,
  });

  if ("error" in emailResult) {
    await db.delete(authVerification).where(eq(authVerification.identifier, identifier));
    return failure("Não foi possível enviar o código de verificação.", 500);
  }

  return success(null);
}

export async function confirmCurrentUserEmailChange(userId: string, newEmail: string, code: string) {
  const verificationIdentifier = `email-change-otp-${userId}-${newEmail}`;
  const verification = await db.query.authVerification.findFirst({
    where: eq(authVerification.identifier, verificationIdentifier),
  });

  if (!verification || verification.expiresAt < new Date()) {
    return failure("Código expirado ou inválido.", 400);
  }

  const [storedOtp] = verification.value.split(":").slice(0, 1);
  if (storedOtp !== code) {
    return failure("Código incorreto.", 400);
  }

  const emailConflict = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(and(eq(authUser.email, newEmail), ne(authUser.id, userId)))
    .limit(1);

  if (emailConflict.length > 0) {
    return failure("Este e-mail já está sendo usado.", 400, { field: "email" });
  }

  const updatedUser = await db
    .update(authUser)
    .set({ email: newEmail })
    .where(eq(authUser.id, userId))
    .returning();

  if (updatedUser.length === 0) return failure("Erro ao confirmar alteração de e-mail", 500);

  await db.delete(authVerification).where(eq(authVerification.identifier, verificationIdentifier));

  return success(null);
}

export async function updateCurrentUserProfileImage(userId: string, file: { originalname: string; buffer: Buffer }) {
  const currentUserData = await db
    .select({ image: authUser.image })
    .from(authUser)
    .where(eq(authUser.id, userId))
    .limit(1);

  if (currentUserData.length === 0) return failure("Usuário não encontrado", 404);

  const currentImageUrl = currentUserData[0].image ?? null;
  if (currentImageUrl) {
    const match = currentImageUrl.match(/\/uploads\/([^/]+)\/(.+)$/);
    if (match) {
      const [, kind, filename] = match;
      if (kind && filename && isUploadKind(kind) && isSafeFilename(filename)) {
        await deleteUploadFile(kind, filename).catch(() => undefined);
      }
    }
  }

  const stored = await storeBufferAsWebp("avatars", file.originalname, file.buffer, {
    mode: "square",
    size: 128,
    quality: 85,
  });
  const imageUrl = `/uploads/avatars/${stored}`;

  const updatedUser = await db
    .update(authUser)
    .set({ image: imageUrl })
    .where(eq(authUser.id, userId))
    .returning();

  if (updatedUser.length === 0) return failure("Erro ao atualizar imagem", 500);

  return success({ imageUrl });
}
