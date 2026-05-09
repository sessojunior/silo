import type { Request, Response as ExpressResponse, Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { respondServiceError as respondAuthServiceError } from "../../lib/respond-service-error.js";
import { authLoginPasswordSchema, authSetupPasswordSchema } from "@silo/engine/validation/auth";
import { completePasswordSetup, signInWithPassword } from "../../services/auth-custom-service.js";
import { appendSetCookieHeaders, buildHeaders, getRequestIp, respondAuthInfrastructureError } from "./shared.js";

export const registerAuthCustomPasswordRoutes = (router: Router): void => {
  router.post("/login/password", validate(authLoginPasswordSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, password } = req.body as z.infer<typeof authLoginPasswordSchema>;
      const ip = getRequestIp(req);

      const result = await signInWithPassword({ email, password, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao entrar.");
        return;
      }

      appendSetCookieHeaders(res, result.data.setCookieHeaders);
      res.json({ success: true, data: { signedIn: true }, message: "Login realizado com sucesso!" });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] login/password:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao entrar." });
    }
  });

  router.post("/setup-password", validate(authSetupPasswordSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, code, password, autoSignIn } = req.body as z.infer<typeof authSetupPasswordSchema>;
      const result = await completePasswordSetup({
        email,
        code,
        password,
        autoSignIn,
        headers: buildHeaders(req),
      });

      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao definir senha.");
        return;
      }

      appendSetCookieHeaders(res, result.data.setCookieHeaders);
      res.json({ success: true, data: { signedIn: result.data.signedIn }, message: "Senha definida com sucesso." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] setup-password:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao definir senha." });
    }
  });
};