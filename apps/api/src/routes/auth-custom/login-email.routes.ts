import type { Request, Response as ExpressResponse, Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { respondServiceError as respondAuthServiceError } from "../../lib/respond-service-error.js";
import { authEmailSendOtpSchema, authEmailVerifyOtpSchema, appendSetCookieHeaders, buildHeaders, getRequestIp, respondAuthInfrastructureError } from "./shared.js";
import { sendLoginEmailOtp, verifyLoginEmailOtp } from "../../services/auth-custom-service.js";

export const registerAuthCustomLoginEmailRoutes = (router: Router): void => {
  router.post("/login-email/send-otp", validate(authEmailSendOtpSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, resend } = req.body as z.infer<typeof authEmailSendOtpSchema>;
      const ip = getRequestIp(req);
      const result = await sendLoginEmailOtp({ email, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao enviar código.");
        return;
      }

      res.json({ success: true, data: { cooldownSeconds: result.data.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] login-email/send-otp:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao enviar código." });
    }
  });

  router.post("/login-email/verify-otp", validate(authEmailVerifyOtpSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, code } = req.body as z.infer<typeof authEmailVerifyOtpSchema>;
      const ip = getRequestIp(req);
      const result = await verifyLoginEmailOtp({ email, code, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao verificar código.");
        return;
      }

      appendSetCookieHeaders(res, result.data.setCookieHeaders);
      res.json({ success: true, data: { signedIn: true }, message: "Login realizado com sucesso!" });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] login-email/verify-otp:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao verificar código." });
    }
  });
};