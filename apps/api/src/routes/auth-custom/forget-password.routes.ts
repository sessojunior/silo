import type { Request, Response as ExpressResponse, Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { respondServiceError as respondAuthServiceError } from "../../lib/respond-service-error.js";
import { authForgetPasswordSchema, authVerifyForgetPasswordOtpSchema } from "@silo/engine/validation/auth";
import { sendForgetPasswordOtp, verifyForgetPasswordOtp } from "../../services/auth-custom-service.js";
import { buildHeaders, getRequestIp, respondAuthInfrastructureError } from "./shared.js";

export const registerAuthCustomForgetPasswordRoutes = (router: Router): void => {
  router.post("/forget-password", validate(authForgetPasswordSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, resend } = req.body as z.infer<typeof authForgetPasswordSchema>;
      const ip = getRequestIp(req);
      const result = await sendForgetPasswordOtp({ email, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao enviar código.");
        return;
      }

      res.json({ success: true, data: { step: 2, email: result.data.email, cooldownSeconds: result.data.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] forget-password:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao enviar código." });
    }
  });

  router.post("/forget-password/verify-otp", validate(authVerifyForgetPasswordOtpSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, code } = req.body as z.infer<typeof authVerifyForgetPasswordOtpSchema>;
      const ip = getRequestIp(req);
      const result = await verifyForgetPasswordOtp({ email, code, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao verificar código.");
        return;
      }

      res.json({ success: true, data: { success: true } });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] forget-password/verify-otp:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao verificar código." });
    }
  });
};