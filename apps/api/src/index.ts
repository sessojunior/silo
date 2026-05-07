import "./infra/load-env";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { config } from "@silo/engine/config";
import authRouter from "./routes/auth";
import authCustomRouter from "./routes/auth-custom";
import productsRouter from "./routes/products";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import incidentsRouter from "./routes/incidents";
import usersRouter from "./routes/users";
import groupsRouter from "./routes/groups";
import contactsRouter from "./routes/contacts";
import helpRouter from "./routes/help";
import dashboardRouter from "./routes/dashboard";
import chatRouter from "./routes/chat";
import aiAssistantRouter from "./routes/ai-assistant";
import uploadRouter from "./routes/upload";
import reportsRouter from "./routes/reports";
import monitoringRouter from "./routes/monitoring";
import productsExtendedRouter from "./routes/products-extended";
import productFlowRouter from "./routes/product-flow";
import serverTimeRouter from "./routes/server-time";
import { rateLimit } from "./middleware/rate-limit";
import { initializeChatRealtime } from "./realtime/chat-realtime.js";

const app = express();
const PORT = config.apiPort;

const corsOrigins = config.apiCorsOrigins;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// Auth routes — better-auth handles /api/auth/*
app.use("/api/auth", authCustomRouter);
app.use("/api/auth", authRouter);

// Domain routes
app.use("/api/products", productsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/help", helpRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ai-assistant", aiAssistantRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/products", productsExtendedRouter);
app.use("/api/product-flow", productFlowRouter);
app.use("/api/server-time", serverTimeRouter);

import { getUserGroups, isAdmin } from "./middleware/permissions";
import { authMiddleware } from "./middleware/auth";
import type { AuthUser } from "./auth/setup";

// ...

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "silo-api", timestamp: new Date().toISOString() });
});

// GET /api/check-admin
app.get("/api/check-admin", authMiddleware, async (req, res) => {
  try {
    const user = req.user as AuthUser | undefined;
    if (!user) { res.status(401).json({ success: false, error: "Não autenticado.", data: { isAdmin: false } }); return; }
    const groups = await getUserGroups(user.id);
    res.json({ success: true, data: { isAdmin: isAdmin(groups) } });
  } catch (err) {
    console.error("❌ check-admin:", err);
    res.status(500).json({ success: false, data: { isAdmin: false }, error: "Erro interno" });
  }
});

const server = createServer(app);
initializeChatRealtime(server);

server.listen(PORT, () => {
  console.log(`[api] Running on http://localhost:${PORT}`);
});

export default app;
