import { Router } from "express";
import productsExtendedRouter from "./products-extended";
import productsRouter from "./products";

const router = Router();

router.use(productsRouter);
router.use(productsExtendedRouter);

export default router;