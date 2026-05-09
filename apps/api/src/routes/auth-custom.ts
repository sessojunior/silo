import { Router } from "express";
import { registerAuthCustomForgetPasswordRoutes } from "./auth-custom/forget-password.routes.js";
import { registerAuthCustomGoogleRoutes } from "./auth-custom/google.routes.js";
import { registerAuthCustomLoginEmailRoutes } from "./auth-custom/login-email.routes.js";
import { registerAuthCustomPasswordRoutes } from "./auth-custom/login-password.routes.js";
import { registerAuthCustomSessionRoutes } from "./auth-custom/session.routes.js";
import { registerAuthCustomSignUpEmailRoutes } from "./auth-custom/sign-up-email.routes.js";

const router = Router();

registerAuthCustomForgetPasswordRoutes(router);
registerAuthCustomLoginEmailRoutes(router);
registerAuthCustomPasswordRoutes(router);
registerAuthCustomSessionRoutes(router);
registerAuthCustomSignUpEmailRoutes(router);
registerAuthCustomGoogleRoutes(router);

export default router;