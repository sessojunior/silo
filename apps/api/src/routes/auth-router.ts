import { Router } from "express";
import authRouter from "./auth";
import authCustomRouter from "./auth-custom";

const router = Router();

router.use(authCustomRouter);
router.use(authRouter);

export default router;