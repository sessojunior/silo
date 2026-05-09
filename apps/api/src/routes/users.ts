import { Router } from "express";
import { randomUUID, randomInt } from "crypto";
import path from "path";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission, requireAdmin, getUserGroups, getPermissions, isAdmin } from "../middleware/permissions.js";
import { validate } from "../middleware/validate.js";
import { respondServiceError as respondUserServiceError } from "../lib/respond-service-error.js";
import * as userService from "../services/user-service.js";
import { db } from "@silo/database";
import { authUser } from "@silo/database/schema";
import { eq, and } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";
import { z } from "zod";
import type { Request, Response as ExpressResponse } from "express";
import multer from "multer";
import {
  userCreateSchema,
  userDeleteQuerySchema,
  userEmailChangeConfirmSchema,
  userEmailSchema,
  userIdParamSchema,
  userPasswordSchema,
  userPreferencesSchema,
  userListQuerySchema,
  userProfileSchema,
  userProfileImageUpdateSchema,
  userUpdateSchema,
} from "@silo/engine/validation/users";

const router = Router();

type RequestWithUser = Request & {
  user?: {
    id?: string;
  };
};

const respondUserBadRequest = (res: ExpressResponse, message: string): void => {
  res.status(400).json({ success: false, error: message });
};

const getAuthenticatedUserId = (req: Request, res: ExpressResponse): string | null => {
  const userId = (req as RequestWithUser).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Não autenticado" });
    return null;
  }

  return userId;
};

// GET /api/users
router.get(
  "/",
  authMiddleware,
  requirePermission("users", "list"),
  validate(userListQuerySchema, "query"),
  async (req, res) => {
    try {
      const { search, status, groupId } = req.query as z.infer<typeof userListQuerySchema>;
      const result = await userService.listUsers({ search, status, groupId });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error("❌ [API_USERS] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

// POST /api/users
router.post("/", authMiddleware, requirePermission("users", "create"), validate(userCreateSchema), async (req, res) => {
  try {
    const result = await userService.createUser(req.body, req.headers);
    if (respondUserServiceError(res, result, "Erro ao criar usuário.")) {
      return;
    }
    res.status(201).json({ success: true, data: result.data, message: "Usuário criado com sucesso." });
  } catch (err) {
    console.error("❌ [API_USERS] POST:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// PUT /api/users
router.put("/", authMiddleware, requirePermission("users", "update"), validate(userUpdateSchema), async (req, res) => {
  try {
    const result = await userService.updateUser(req.body);
    if (respondUserServiceError(res, result, "Erro ao atualizar usuário.")) {
      return;
    }
    res.json({ success: true, data: result.data, message: "Usuário atualizado com sucesso." });
  } catch (err) {
    console.error("❌ [API_USERS] PUT:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
});

// DELETE /api/users?id=...
router.delete(
  "/",
  authMiddleware,
  requirePermission("users", "delete"),
  validate(userDeleteQuerySchema, "query"),
  async (req, res) => {
    try {
      const { id } = req.query as z.infer<typeof userDeleteQuerySchema>;
      const result = await userService.deleteUser(id);
      if (respondUserServiceError(res, result, "Erro ao excluir usuário.")) {
        return;
      }
      res.json({ success: true, message: "Usuário excluído com sucesso." });
    } catch (err) {
      console.error("❌ [API_USERS] DELETE:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  },
);

// POST /api/users/:id/resend-password-setup
router.post(
  "/:id/resend-password-setup",
  authMiddleware,
  requireAdmin(),
  validate(userIdParamSchema, "params"),
  async (req, res) => {
  try {
    const { id } = req.params as z.infer<typeof userIdParamSchema>;
    const result = await userService.resendPasswordSetup(id);
    if (respondUserServiceError(res, result, "Erro ao reenviar setup de senha.")) {
      return;
    }

    res.json({ success: true, message: "Código OTP para definição de senha reenviado." });
  } catch (err) {
    console.error("❌ [API_USERS] resend-password-setup:", err);
    res.status(500).json({ success: false, error: "Erro interno do servidor" });
  }
  },
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/users/profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const result = await userService.getCurrentUserProfile(userId);
    if (respondUserServiceError(res, result, "Erro ao carregar perfil.")) {
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [API_USERS] GET /profile:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar perfil" });
  }
});

// PUT /api/users/profile
router.put("/profile", authMiddleware, validate(userProfileSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { name, phone, company, genre, role, location, team } = req.body as z.infer<typeof userProfileSchema>;

    const result = await userService.updateCurrentUserProfile(userId, { name, phone, company, genre, role, location, team });
    if (respondUserServiceError(res, result, "Erro ao atualizar perfil.")) {
      return;
    }

    res.json({ success: true, message: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] PUT /profile:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar perfil" });
  }
});

// POST /api/users/profile-image (multipart/form-data with fileToUpload)
router.post("/profile-image", authMiddleware, upload.single("fileToUpload"), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    if (!req.file) { respondUserBadRequest(res, "Arquivo não enviado"); return; }
    const result = await userService.updateCurrentUserProfileImage(userId, {
      originalname: req.file.originalname,
      buffer: req.file.buffer,
    });
    if (!result.ok) {
      respondUserServiceError(res, result, "Erro ao atualizar imagem.");
      return;
    }

    const imageUrl = result.data.imageUrl;
    res.json({ success: true, data: { imageUrl }, message: "Imagem alterada com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] POST /profile-image:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar imagem" });
  }
});

// GET /api/users/preferences
router.get("/preferences", authMiddleware, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const result = await userService.getCurrentUserPreferences(userId);
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("❌ [API_USERS] GET /preferences:", err);
    res.status(500).json({ success: false, error: "Erro ao carregar preferências" });
  }
});

// PUT /api/users/preferences
router.put("/preferences", authMiddleware, validate(userPreferencesSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { chatEnabled } = req.body as z.infer<typeof userPreferencesSchema>;
    const result = await userService.updateCurrentUserPreferences(userId, chatEnabled);
    if (respondUserServiceError(res, result, "Erro ao atualizar preferências.")) {
      return;
    }
    res.json({ success: true, message: "Preferências atualizadas com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] PUT /preferences:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar preferências" });
  }
});

// PUT /api/users/email — update email directly
router.put("/email", authMiddleware, validate(userEmailSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { email: newEmail } = req.body as z.infer<typeof userEmailSchema>;
    const result = await userService.updateCurrentUserEmail(userId, newEmail);
    if (respondUserServiceError(res, result, "Erro ao alterar e-mail.")) {
      return;
    }
    res.json({ success: true, message: "E-mail alterado com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] PUT /email:", err);
    res.status(500).json({ success: false, error: "Erro ao alterar e-mail" });
  }
});

// POST /api/users/email-change — request email change OTP
router.post("/email-change", authMiddleware, validate(userEmailSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { email: newEmail } = req.body as z.infer<typeof userEmailSchema>;
    const result = await userService.requestCurrentUserEmailChange(userId, newEmail);
    if (respondUserServiceError(res, result, "Erro ao solicitar alteração de e-mail.")) {
      return;
    }
    res.json({ success: true, message: "Código de verificação enviado para o novo e-mail." });
  } catch (err) {
    console.error("❌ [API_USERS] POST /email-change:", err);
    res.status(500).json({ success: false, error: "Erro ao solicitar alteração de e-mail" });
  }
});

// PUT /api/users/email-change — confirm email change with OTP
router.put("/email-change", authMiddleware, validate(userEmailChangeConfirmSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { code, newEmail } = req.body as z.infer<typeof userEmailChangeConfirmSchema>;
    const result = await userService.confirmCurrentUserEmailChange(userId, newEmail, code);
    if (respondUserServiceError(res, result, "Erro ao confirmar alteração de e-mail.")) {
      return;
    }
    res.json({ success: true, message: "E-mail alterado com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] PUT /email-change:", err);
    res.status(500).json({ success: false, error: "Erro ao confirmar alteração de e-mail" });
  }
});

// PUT /api/users/password — change password
router.put("/password", authMiddleware, validate(userPasswordSchema), async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req, res);
    if (!userId) return;
    const { password } = req.body as z.infer<typeof userPasswordSchema>;

    const result = await userService.updateCurrentUserPassword(userId, password);
    if (respondUserServiceError(res, result, "Erro ao alterar senha.")) {
      return;
    }

    res.json({ success: true, message: "Senha alterada com sucesso!" });
  } catch (err) {
    console.error("❌ [API_USERS] PUT /password:", err);
    res.status(500).json({ success: false, error: "Erro ao alterar senha" });
  }
});

// POST /api/users/profile-image/update — update profile image URL in DB
router.post(
  "/profile-image/update",
  authMiddleware,
  validate(userProfileImageUpdateSchema),
  async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req, res);
      if (!userId) return;
      const { imageUrl } = req.body as z.infer<typeof userProfileImageUpdateSchema>;
      const result = await userService.updateCurrentUserProfileImageUrl(userId, imageUrl);
      if (!result.ok) {
        respondUserServiceError(res, result, "Erro ao atualizar URL da imagem.");
        return;
      }
      res.json({ success: true, data: { imageUrl: result.data.imageUrl }, message: "URL da imagem atualizada com sucesso!" });
    } catch (err) {
      console.error("❌ [API_USERS] POST /profile-image/update:", err);
      res.status(500).json({ success: false, error: "Erro ao atualizar URL da imagem" });
    }
  },
);

export default router;
