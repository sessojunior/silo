import { Router } from "express";
import authRouter from "./auth.js";
import authCustomRouter from "./auth-custom.js";

const router = Router();

router.use(authCustomRouter);
router.use(authRouter);

export default router;