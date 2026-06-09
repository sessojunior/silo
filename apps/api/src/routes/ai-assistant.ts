import { Router } from "express";

import { AiAssistantMessageRequestSchema } from "@silo/engine/contracts/dto/ai-assistant";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  AssistantThreadNotFoundError,
  createAssistantThread,
  getAssistantExamplesResponse,
  getAssistantThreadDetails,
  listAssistantThreads,
  sendAssistantMessage,
  sendAssistantMessageStream,
} from "../services/ai-assistant-thread-service.js";
import { getAssistantRuntimeStatus } from "../services/ai-assistant-service.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/status",
  requirePermission("reports", "view"),
  async (_req, res) => {
    try {
      const data = await getAssistantRuntimeStatus();
      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ [API_AI_ASSISTANT/STATUS] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

router.get(
  "/examples",
  requirePermission("reports", "view"),
  async (_req, res) => {
    try {
      const data = getAssistantExamplesResponse();
      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ [API_AI_ASSISTANT/EXAMPLES] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

router.get(
  "/threads",
  requirePermission("reports", "view"),
  async (req, res) => {
    try {
      const user = req.user!;
      const data = await listAssistantThreads(user.id);
      res.json({ success: true, data });
    } catch (err) {
      console.error("❌ [API_AI_ASSISTANT/THREADS] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

router.post(
  "/threads",
  requirePermission("reports", "view"),
  async (req, res) => {
    try {
      const user = req.user!;
      const data = await createAssistantThread(user.id);
      res.status(201).json({ success: true, data, message: "Conversa criada com sucesso." });
    } catch (err) {
      console.error("❌ [API_AI_ASSISTANT/THREADS] POST:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

router.get(
  "/threads/:threadId",
  requirePermission("reports", "view"),
  async (req, res) => {
    try {
      const user = req.user!;
      const threadId =
        typeof req.params.threadId === "string" ? req.params.threadId : null;

      if (!threadId) {
        res.status(400).json({ success: false, error: "Identificador da conversa inválido." });
        return;
      }

      const thread = await getAssistantThreadDetails(user.id, threadId);

      if (!thread) {
        res.status(404).json({ success: false, error: "Conversa não encontrada." });
        return;
      }

      res.json({ success: true, data: thread });
    } catch (err) {
      console.error("❌ [API_AI_ASSISTANT/THREADS/:ID] GET:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

router.post(
  "/messages",
  requirePermission("reports", "view"),
  async (req, res) => {
    try {
      const user = req.user!;
      const parsedBody = AiAssistantMessageRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          success: false,
          error: "Mensagem inválida.",
          field: "content",
        });
        return;
      }

      const response = await sendAssistantMessage(user, parsedBody.data);

      res.json({ success: true, data: response });
    } catch (err) {
      if (err instanceof AssistantThreadNotFoundError) {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      console.error("❌ [API_AI_ASSISTANT/MESSAGES] POST:", err);
      res.status(500).json({ success: false, error: "Erro interno" });
    }
  },
);

// Streaming: POST /api/ai-assistant/messages/stream
// Retorna Server-Sent Events com o pensamento do modelo em tempo real
router.post(
  "/messages/stream",
  requirePermission("reports", "view"),
  async (req, res) => {
    try {
      const user = req.user!;
      const parsedBody = AiAssistantMessageRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          success: false,
          error: "Mensagem inválida.",
          field: "content",
        });
        return;
      }

      // Configura headers SSE
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Envia evento inicial imediatamente para manter a conexão viva
      // enquanto a classificação de escopo e coleta de dados são processadas
      sendEvent("connected", { status: "processing" });

      // Heartbeat a cada 5s para evitar timeout do proxy durante o processamento inicial
      const heartbeatInterval = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 5_000);

      try {
        await sendAssistantMessageStream(user, parsedBody.data, sendEvent);
      } finally {
        clearInterval(heartbeatInterval);
      }

      res.end();
    } catch (err) {
      if (err instanceof AssistantThreadNotFoundError) {
        if (!res.headersSent) {
          res.status(404).json({ success: false, error: err.message });
        }
        return;
      }
      console.error("❌ [API_AI_ASSISTANT/MESSAGES/STREAM] POST:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Erro interno" });
      } else {
        res.end();
      }
    }
  },
);

export default router;