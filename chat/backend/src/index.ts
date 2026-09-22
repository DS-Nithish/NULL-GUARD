import express, { Request, Response } from "express";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { initDb } from "./db";
import {
  createConversation,
  insertMessage,
  getMessagesByConversation,
  insertToolRequest,
  updateToolRequest,
  getToolRequestById,
} from "./db/repository";
import { getAllDocumentsPublic, getDocumentById } from "./services/documents";
import { evaluate } from "./services/firewall";
import { executeTool, TOOL_RISK_MAP } from "./services/gateway";
import { runAgentReasoning } from "./services/agent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Initialize SQLite schema
initDb();

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "AgentShield Chat Backend" });
});

/**
 * POST /api/chat/new
 * Initializes a new conversation thread.
 */
app.post("/api/chat/new", (_req: Request, res: Response) => {
  try {
    const id = generateId("conv");
    const conv = createConversation(id);
    res.json({ conversationId: conv.id });
  } catch (err) {
    console.error("Error creating conversation:", err);
    res.status(500).json({ error: "Failed to initialize conversation" });
  }
});

/**
 * GET /api/documents
 * Returns the list of 3 available fake documents for the attachment dropdown.
 */
app.get("/api/documents", (_req: Request, res: Response) => {
  try {
    const docs = getAllDocumentsPublic();
    res.json(docs);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ error: "Failed to fetch document store" });
  }
});

/**
 * GET /api/chat/:conversationId/messages
 * Fetches all messages in the conversation, including inline tool request payloads.
 */
app.get("/api/chat/:conversationId/messages", (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const messages = getMessagesByConversation(conversationId);
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to retrieve conversation messages" });
  }
});

/**
 * POST /api/chat/message
 * Handles sending a message to the agent, checking attached documents,
 * and intercepting tool calls via AgentShield firewall.
 */
app.post("/api/chat/message", async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, message, attachedDocumentId } = req.body;

    if (!conversationId || !message) {
      res.status(400).json({ error: "conversationId and message are required" });
      return;
    }

    // 1. Store User Message
    const userMsgId = generateId("msg");
    insertMessage({
      id: userMsgId,
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    // 2. Resolve document context if attached
    const attachedDoc = attachedDocumentId ? getDocumentById(attachedDocumentId) : null;
    const source_type = attachedDoc ? "PDF" : "USER";
    const trust_level = attachedDoc ? "UNTRUSTED" : "TRUSTED";

    // 3. Run Agent Reasoning (Anthropic SDK or deterministic simulation)
    const agentResult = await runAgentReasoning(message, attachedDoc);

    // 4. Handle proposed tool call or plain text
    if (agentResult.proposedToolCall) {
      const { toolName, arguments: toolArgs } = agentResult.proposedToolCall;
      const risk_level = TOOL_RISK_MAP[toolName] || "HIGH";

      // Determine taint: true if document was attached and isMalicious
      const tainted = Boolean(attachedDoc && attachedDoc.isMalicious);

      // Evaluate through AgentShield Firewall
      const firewallDecision = evaluate({
        trustLevel: trust_level,
        tainted,
        riskLevel: risk_level,
      });

      const toolRequestId = generateId("req");
      const status = firewallDecision.decision === "CONFIRM" ? "pending" : "resolved";

      let executionResult = null;
      if (firewallDecision.decision === "ALLOW") {
        executionResult = executeTool(toolName, toolArgs);
      }

      // Record tool request in SQLite
      insertToolRequest({
        id: toolRequestId,
        conversation_id: conversationId,
        tool_name: toolName,
        arguments: toolArgs,
        source_type,
        trust_level,
        tainted,
        risk_level,
        decision: firewallDecision.decision,
        reason: firewallDecision.reason,
        status,
        execution_result: executionResult as unknown as Record<string, unknown>,
      });

      // Insert agent message associated with this tool event card
      const agentMsgId = generateId("msg");
      insertMessage({
        id: agentMsgId,
        conversation_id: conversationId,
        role: "agent",
        content: agentResult.responseText || "Evaluating requested tool execution with AgentShield...",
        tool_request_id: toolRequestId,
      });
    } else {
      // Plain text agent response
      const agentMsgId = generateId("msg");
      insertMessage({
        id: agentMsgId,
        conversation_id: conversationId,
        role: "agent",
        content: agentResult.responseText,
      });
    }

    // Return the updated full message list
    const messages = getMessagesByConversation(conversationId);
    res.json(messages);
  } catch (err) {
    console.error("Error processing chat message:", err);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

/**
 * POST /api/chat/approve/:toolRequestId
 * Operator approves a pending CONFIRM tool call -> executes tool via Gateway.
 */
app.post("/api/chat/approve/:toolRequestId", (req: Request, res: Response): void => {
  try {
    const { toolRequestId } = req.params;
    const toolReq = getToolRequestById(toolRequestId);

    if (!toolReq) {
      res.status(404).json({ error: `Tool request '${toolRequestId}' not found` });
      return;
    }

    if (toolReq.status !== "pending" || toolReq.decision !== "CONFIRM") {
      res.status(400).json({
        error: `Cannot approve request with decision '${toolReq.decision}' and status '${toolReq.status}'`,
      });
      return;
    }

    const args = JSON.parse(toolReq.arguments);

    // CRITICAL: Authorized call to Tool Gateway
    const executionResult = executeTool(toolReq.tool_name, args);

    // Update state to ALLOW
    updateToolRequest(toolRequestId, {
      decision: "ALLOW",
      status: "resolved",
      execution_result: executionResult as unknown as Record<string, unknown>,
    });

    // Append resolution message to chat thread
    const resMsgId = generateId("msg");
    insertMessage({
      id: resMsgId,
      conversation_id: toolReq.conversation_id,
      role: "agent",
      content: `Tool '${toolReq.tool_name}' was approved and executed successfully via the Tool Gateway.`,
    });

    const messages = getMessagesByConversation(toolReq.conversation_id);
    res.json({
      success: true,
      executionResult,
      messages,
    });
  } catch (err) {
    console.error("Error approving tool request:", err);
    res.status(500).json({ error: "Failed to approve tool request" });
  }
});

/**
 * POST /api/chat/deny/:toolRequestId
 * Operator denies a pending CONFIRM tool call -> marked BLOCK, Gateway NEVER called.
 */
app.post("/api/chat/deny/:toolRequestId", (req: Request, res: Response): void => {
  try {
    const { toolRequestId } = req.params;
    const toolReq = getToolRequestById(toolRequestId);

    if (!toolReq) {
      res.status(404).json({ error: `Tool request '${toolRequestId}' not found` });
      return;
    }

    updateToolRequest(toolRequestId, {
      decision: "BLOCK",
      status: "resolved",
    });

    const resMsgId = generateId("msg");
    insertMessage({
      id: resMsgId,
      conversation_id: toolReq.conversation_id,
      role: "agent",
      content: `Tool '${toolReq.tool_name}' execution was denied by operator.`,
    });

    const messages = getMessagesByConversation(toolReq.conversation_id);
    res.json({
      success: true,
      messages,
    });
  } catch (err) {
    console.error("Error denying tool request:", err);
    res.status(500).json({ error: "Failed to deny tool request" });
  }
});

if (!process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`AgentShield Chat Backend running on http://localhost:${PORT}`);
  });
}

export { app };
