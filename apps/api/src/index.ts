import "./infra/load-env.js";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import type { Request } from "express";
import { auth } from "./auth/setup.js";
import { config, configValidation } from "@silo/engine/config";
import { registerRoutes } from "./routes/index.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { initializeChatRealtime } from "./realtime/chat-realtime.js";
import { toHeaders } from "./lib/request-headers.js";

const resolveApiRateLimitKey = async (req: Request): Promise<string> => {
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  if (!req.headers.cookie) {
    return `ip:${clientIp}`;
  }

  try {
    const session = await auth.api.getSession({ headers: toHeaders(req.headers) });
    if (session?.user?.id) {
      return `user:${session.user.id}`;
    }
  } catch (error) {
    console.warn("⚠️ [RATE_LIMIT] Não foi possível resolver a sessão, usando IP:", error);
  }

  return `ip:${clientIp}`;
};

const app = express();
configValidation.validateProductionConfig();
const PORT = config.apiPort;

const corsOrigins = config.apiCorsOrigins;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 200,
    keyPrefix: "api",
    keyGenerator: resolveApiRateLimitKey,
    skip: (req) => req.originalUrl.startsWith("/api/auth"),
  }),
);

registerRoutes(app);

const server = createServer(app);
initializeChatRealtime(server);

server.listen(PORT, () => {
  console.log(`[api] Running on http://localhost:${PORT}`);
});

// Pré-aquece os embeddings dos escopos do assistente de IA em background.
// Não bloqueia o boot — se falhar, a primeira requisição fará o warmup sob demanda.
import("./services/ai-assistant-scope-embedding.js")
  .then(({ warmupScopeEmbeddings }) => warmupScopeEmbeddings())
  .catch((err) => {
    console.warn("⚠️ [BOOT] Falha ao pré-aquecer embeddings de escopo:", err instanceof Error ? err.message : String(err));
  });

export default app;
