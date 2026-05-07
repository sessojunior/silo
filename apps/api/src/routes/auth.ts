import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth/setup";

const router = Router();

// Mount better-auth handler for all /api/auth/* paths
// toNodeHandler converts the Web API handler to Node.js http handler
router.use(toNodeHandler(auth.handler));

export default router;
