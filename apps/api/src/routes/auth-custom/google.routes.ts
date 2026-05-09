import type { Request, Response as ExpressResponse, Router } from "express";
import { respondServiceError as respondAuthServiceError } from "../../lib/respond-service-error.js";
import { loginWithGoogle } from "../../services/auth-custom-service.js";
import { buildHeaders, respondAuthInfrastructureError } from "./shared.js";

export const registerAuthCustomGoogleRoutes = (router: Router): void => {
  router.get("/login-google", async (req: Request, res: ExpressResponse) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const result = await loginWithGoogle({ from, headers: buildHeaders(req) });
      if (!result.ok) {
        respondAuthServiceError(res, result, "Erro ao iniciar login com Google.");
        return;
      }

      const { response, fallbackRedirect } = result.data;
      if (response instanceof Response) {
        for (const [key, value] of response.headers.entries()) {
          if (key.toLowerCase() !== "transfer-encoding") res.setHeader(key, value);
        }
        res.status(response.status);
        if (response.body) {
          const text = await response.text();
          res.send(text);
        } else {
          res.end();
        }
        return;
      }

      res.redirect(fallbackRedirect ?? "/login");
    } catch (err) {
      console.error("❌ [AUTH_CUSTOM] login-google:", err);
      if (respondAuthInfrastructureError(res, err)) return;
      res.status(500).json({ success: false, error: "Erro ao iniciar login com Google." });
    }
  });
};