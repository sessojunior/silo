import "./infra/load-env";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { config, configValidation } from "@silo/engine/config";
import { registerRoutes } from "./routes";
import { rateLimit } from "./middleware/rate-limit";
import { initializeChatRealtime } from "./realtime/chat-realtime.js";

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
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

registerRoutes(app);

const server = createServer(app);
initializeChatRealtime(server);

server.listen(PORT, () => {
  console.log(`[api] Running on http://localhost:${PORT}`);
});

export default app;
