import { Router } from "express";
import productsExtendedRouter from "./products-extended.js";
import productsRouter from "./products.js";

const router = Router();

router.use(productsRouter);
router.use(productsExtendedRouter);

export default router;