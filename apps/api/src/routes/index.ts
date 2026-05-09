import type { Express } from "express";

import { authMiddleware } from "../middleware/auth.js";
import { getUserGroups, isAdmin } from "../middleware/permissions.js";
import type { AuthUser } from "../auth/setup";
import authRouter from "./auth-router";
import productsRouter from "./products-router";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import incidentsRouter from "./incidents";
import usersRouter from "./users";
import groupsRouter from "./groups";
import contactsRouter from "./contacts";
import helpRouter from "./help";
import dashboardRouter from "./dashboard";
import chatRouter from "./chat";
import aiAssistantRouter from "./ai-assistant";
import uploadRouter from "./upload";
import reportsRouter from "./reports";
import monitoringRouter from "./monitoring";
import productFlowRouter from "./product-flow";
import serverTimeRouter from "./server-time";

export function registerRoutes(app: Express): void {
  // Auth routes — better-auth handles /api/auth/*
  app.use("/api/auth", authRouter);

  // Domain routes
  app.use("/api/products", productsRouter);
  app.use("/api/product-flow", productFlowRouter);
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
  app.use("/api/server-time", serverTimeRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", app: "silo-api", timestamp: new Date().toISOString() });
  });

  // GET /api/check-admin
  app.get("/api/check-admin", authMiddleware, async (req, res) => {
    try {
      const user = req.user as AuthUser | undefined;
      if (!user) {
        res.status(401).json({ success: false, error: "Não autenticado.", data: { isAdmin: false } });
        return;
      }

      const groups = await getUserGroups(user.id);
      res.json({ success: true, data: { isAdmin: isAdmin(groups) } });
    } catch (err) {
      console.error("❌ check-admin:", err);
      res.status(500).json({ success: false, data: { isAdmin: false }, error: "Erro interno" });
    }
  });
}