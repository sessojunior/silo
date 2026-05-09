import type { Request, Response as ExpressResponse, Router } from "express";
import { getCurrentSession } from "../../services/auth-custom-service.js";
import { buildHeaders, respondAuthInfrastructureError } from "./shared.js";

export const registerAuthCustomSessionRoutes = (router: Router): void => {
  router.get("/get-session", async (req: Request, res: ExpressResponse) => {
    try {
      const session = await getCurrentSession(buildHeaders(req));

      if (!session) {
        res.status(401).json({ success: false, error: "Usuário não autenticado." });
        return;
      }

      res.json(session);
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] get-session:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao buscar sessão." });
    }
  });
};