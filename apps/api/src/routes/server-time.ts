import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  const now = new Date().toISOString();

  res.json({
    success: true,
    data: { time: now },
    message: "Hora do servidor",
  });
});

export default router;