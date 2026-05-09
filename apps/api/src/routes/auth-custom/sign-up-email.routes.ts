import type { Request, Response as ExpressResponse, Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { respondServiceError as respondAuthServiceError } from "../../lib/respond-service-error.js";
import { authEmailSendOtpSchema, authSignUpEmailSchema, authSignUpEmailVerifyOtpSchema, appendSetCookieHeaders, buildHeaders, getRequestIp, respondAuthInfrastructureError } from "./shared.js";
import { createSignUpEmail, sendSignUpEmailOtp, verifySignUpEmailOtp } from "../../services/auth-custom-service.js";

export const registerAuthCustomSignUpEmailRoutes = (router: Router): void => {
  router.post("/sign-up/email", validate(authSignUpEmailSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { name, email, password } = req.body as z.infer<typeof authSignUpEmailSchema>;
      const ip = getRequestIp(req);
      const result = await createSignUpEmail({ name, email, password, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao criar conta.");
        return;
      }

      res.status(201).json({ success: true, data: { cooldownSeconds: result.data.cooldownSeconds }, message: "Conta criada com sucesso. Verifique seu e-mail." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] sign-up/email:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao criar conta." });
    }
  });

  router.post("/sign-up/email/send-otp", validate(authEmailSendOtpSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, resend } = req.body as z.infer<typeof authEmailSendOtpSchema>;
      const ip = getRequestIp(req);
      const result = await sendSignUpEmailOtp({ email, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao enviar código.");
        return;
      }

      res.json({ success: true, data: { cooldownSeconds: result.data.cooldownSeconds }, message: resend ? "Código reenviado para seu e-mail." : "Código enviado para seu e-mail." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] sign-up/email/send-otp:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao enviar código." });
    }
  });

  router.post("/sign-up/email/verify-otp", validate(authSignUpEmailVerifyOtpSchema), async (req: Request, res: ExpressResponse) => {
    try {
      const { email, code, password, autoSignIn } = req.body as z.infer<typeof authSignUpEmailVerifyOtpSchema>;
      const ip = getRequestIp(req);
      const result = await verifySignUpEmailOtp({ email, code, password, autoSignIn, ip, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao verificar código.");
        return;
      }

      appendSetCookieHeaders(res, result.data.setCookieHeaders);
      res.json({ success: true, data: { success: true, signedIn: result.data.signedIn }, message: "Conta verificada com sucesso." });
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] sign-up/email/verify-otp:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao verificar código." });
    }
  });
};