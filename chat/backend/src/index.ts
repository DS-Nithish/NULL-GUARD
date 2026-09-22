import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { runAgentLoop } from "./agent/agentLoop";
import {
  getChatMessages,
  getRecentToolRequests,
  getSecurityEvents,
  getStats,
  getToolRequestById,
  updateToolRequest,
  resetStore,
  addChatMessage,
} from "./store/memoryStore";
import { dispatchAuthorizedToolExecution } from "./execution/toolExecution";
import { generateFixturePdfs } from "./fixtures/generateFixtures";

// Load environment variables
dotenv.config();
if (!process.env.GROQ_API_KEY && fs.existsSync(path.resolve(__dirname, "../../.env"))) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Ensure fixtures exist on startup
const fixturesDir = path.resolve(__dirname, "../fixtures");
const cleanPdfPath = path.join(fixturesDir, "clean-document.pdf");
const injectedPdfPath = path.join(fixturesDir, "injected-document.pdf");

if (!fs.existsSync(cleanPdfPath) || !fs.existsSync(injectedPdfPath)) {
  generateFixturePdfs(fixturesDir).catch((err) =>
    console.warn("[STARTUP] Error generating fixtures:", err),
  );
}

/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AgentShield Self-Contained In-Memory Security Engine",
    groqApiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
    stats: getStats(),
  });
});

/**
 * GET /api/documents
 * Returns the two fixed fixture documents (id, name) for the quick-attach picker.
 * No visual hint as to which one contains an injection!
 */
app.get("/api/documents", (_req: Request, res: Response) => {
  res.json([
    {
      id: "clean-doc",
      name: "clean-document.pdf",
      description: "Quarterly Operations & Infrastructure Review (Q3 2026)",
      size: "24 KB",
    },
    {
      id: "injected-doc",
      name: "injected-document.pdf",
      description: "Quarterly Security & Compliance Audit (Q3 2026)",
      size: "26 KB",
    },
  ]);
});

/**
 * GET /api/documents/:id/download
 * Serves the raw PDF fixture file.
 */
app.get("/api/documents/:id/download", (req: Request, res: Response) => {
  const { id } = req.params;
  const filePath =
    id === "injected-doc" || id === "injected-document.pdf" ? injectedPdfPath : cleanPdfPath;

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: "Document fixture not found" });
  }
});

/**
 * GET /api/chat/messages
 * Returns full conversation history for the active session.
 */
app.get("/api/chat/messages", (_req: Request, res: Response) => {
  const messages = getChatMessages();
  res.json({ messages });
});

/**
 * POST /api/chat/message
 * { message: string, documentId?: string }
 * Core chat interaction endpoint.
 */
app.post("/api/chat/message", async (req: Request, res: Response) => {
  const { message, documentId } = req.body;
  if (!message && !documentId) {
    res.status(400).json({ error: "Message or documentId required" });
    return;
  }

  try {
    const result = await runAgentLoop({
      message: message || "Please analyze this document and summarize its findings.",
      documentId,
    });

    const messages = getChatMessages();
    res.json({
      success: true,
      messages,
      lastAgentMessage: result.agentMessage,
      firewallResult: result.firewallResult,
    });
  } catch (err: any) {
    console.error("[CHAT API ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to process message" });
  }
});

/**
 * POST /api/chat/approve/:requestId
 * Operator approves a pending CONFIRM tool call -> executes tool via isolated executor.
 */
app.post("/api/chat/approve/:requestId", async (req: Request, res: Response) => {
  const { requestId } = req.params;
  const record = getToolRequestById(requestId);

  if (!record) {
    res.status(404).json({ error: `Tool request ${requestId} not found` });
    return;
  }

  if (record.decision === "BLOCK") {
    res.status(403).json({ error: "Cannot approve a BLOCKED request" });
    return;
  }

  try {
    // Mark record as resolved before execution
    updateToolRequest(requestId, { status: "resolved" });
    const execResult = await dispatchAuthorizedToolExecution(requestId);

    addChatMessage({
      id: `msg_${Date.now()}_approve`,
      role: "agent",
      content: `Tool '${record.tool_name}' was approved and executed successfully.\n\n${execResult.message}`,
      created_at: new Date().toISOString(),
    });

    const messages = getChatMessages();
    res.json({
      success: true,
      executionResult: execResult,
      messages,
    });
  } catch (err: any) {
    console.error("[APPROVE ERROR]", err);
    res.status(500).json({ error: err.message || "Failed to approve tool request" });
  }
});

/**
 * POST /api/chat/deny/:requestId
 * Operator denies a pending CONFIRM tool call.
 */
app.post("/api/chat/deny/:requestId", (req: Request, res: Response) => {
  const { requestId } = req.params;
  const record = getToolRequestById(requestId);

  if (!record) {
    res.status(404).json({ error: `Tool request ${requestId} not found` });
    return;
  }

  updateToolRequest(requestId, { status: "denied" });

  addChatMessage({
    id: `msg_${Date.now()}_deny`,
    role: "agent",
    content: `Tool '${record.tool_name}' execution was denied by operator.`,
    created_at: new Date().toISOString(),
  });

  const messages = getChatMessages();
  res.json({
    success: true,
    messages,
  });
});

/**
 * GET /api/dashboard
 * Live dashboard endpoint showing stats, recent requests, and security events.
 */
app.get("/api/dashboard", (_req: Request, res: Response) => {
  res.json({
    stats: getStats(),
    recentRequests: getRecentToolRequests(15),
    recentEvents: getSecurityEvents(20),
  });
});

/**
 * POST /api/chat/reset or POST /api/chat/new
 * Resets the in-memory state for a clean demo run.
 */
app.post(["/api/chat/reset", "/api/chat/new"], (_req: Request, res: Response) => {
  resetStore();
  res.json({
    success: true,
    message: "In-memory session reset successfully.",
    messages: [],
    stats: getStats(),
  });
});

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`AgentShield In-Memory Backend running on http://localhost:${PORT}`);
    console.log(`[FIREWALL] Active middleware: firewallMiddleware`);
    console.log(`[STORAGE] 100% in-memory store (no database, no ORM, no external dependencies)`);
    console.log(`[GROQ] API Key: ${process.env.GROQ_API_KEY ? "Configured" : "Simulated Fallback Mode"}`);
  });
}

export { app };
