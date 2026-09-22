import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import {
  initDb,
  createConversation,
  getConversationById,
  insertMessage,
  getMessagesByConversation,
  insertToolRequest,
  getToolRequestById,
  updateToolRequest,
  generateId,
} from "./db";
import { getAllDocumentsPublic, getDocumentById } from "./services/documents";
import {
  executeTool,
  TOOL_RISK_MAP,
  isApprovedRecipient,
  getApprovedRecipients,
  isGmailLive,
  initGmailMcpClient,
  logGmailAudit,
  AUDIT_LOG_FILE,
} from "./services/gateway";
import { evaluate } from "./services/firewall";
import { runAgentReasoning } from "./services/agent";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Initialize SQLite schema
initDb();

// Attempt connection to Gmail MCP if configured
initGmailMcpClient().catch((err) => {
  console.warn("Gmail MCP init:", err);
});

/**
 * Health check
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AgentShield Chat Backend",
    isLiveGmail: isGmailLive(),
  });
});

/**
 * GET /api/status
 * Returns system live status, Gmail mode, and approved recipients
 */
app.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    isLiveGmail: isGmailLive(),
    approvedRecipients: getApprovedRecipients(),
    auditLogPath: AUDIT_LOG_FILE,
  });
});

/**
 * GET /api/audit-log
 * Returns entries from the dedicated Gmail audit log file
 */
app.get("/api/audit-log", (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      res.json({ entries: [] });
      return;
    }
    const content = fs.readFileSync(AUDIT_LOG_FILE, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries = lines.map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l };
      }
    });
    res.json({ entries });
  } catch (err) {
    console.error("Error reading audit log:", err);
    res.status(500).json({ error: "Failed to read audit log" });
  }
});

/**
 * POST /api/chat/new
 * Creates a new conversation session
 */
app.post("/api/chat/new", (_req: Request, res: Response) => {
  try {
    const convId = generateId("conv");
    const conversation = createConversation(convId);
    res.json({ conversationId: conversation.id });
  } catch (err) {
    console.error("Error creating conversation:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * GET /api/documents
 * Returns public list of preset documents (zero taint/malicious flags leaked)
 */
app.get("/api/documents", (_req: Request, res: Response) => {
  try {
    const docs = getAllDocumentsPublic();
    res.json(docs);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ error: "Failed to retrieve documents" });
  }
});

/**
 * GET /api/chat/:conversationId/messages
 * Returns full message history for rendering/polling
 */
app.get("/api/chat/:conversationId/messages", (req: Request, res: Response): void => {
  try {
    const { conversationId } = req.params;
    const conversation = getConversationById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: `Conversation '${conversationId}' not found` });
      return;
    }
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

      // Taint Detection:
      // Tainted if:
      // - Attached document was flagged malicious (e.g. prompt injection payload)
      // - For send_email: proposed recipient is an unauthorized address or doesn't match what the user requested
      let tainted = false;

      if (attachedDoc && attachedDoc.isMalicious) {
        tainted = true;
      } else if (toolName === "send_email") {
        const proposedTo = String(toolArgs.to || "").toLowerCase();
        const userMsgLower = message.toLowerCase();
        const isRecipientInUserPrompt = proposedTo && userMsgLower.includes(proposedTo);
        const isRecipientApproved = isApprovedRecipient(proposedTo);

        if (proposedTo.includes("attacker") || (!isRecipientInUserPrompt && !isRecipientApproved)) {
          tainted = true;
        } else if (attachedDoc && !isRecipientApproved) {
          tainted = true;
        }
      }

      // Evaluate through AgentShield Firewall
      const firewallDecision = evaluate({
        trustLevel: trust_level,
        tainted,
        riskLevel: risk_level,
      });

      // Tailor plain-English reason for email security context
      if (toolName === "send_email" && firewallDecision.decision === "BLOCK") {
        firewallDecision.reason =
          "Blocked: this email would have been sent to an unauthorized recipient based on hidden instructions found in the attached content.";
        
        // Log block to dedicated audit trail
        logGmailAudit({
          event: "BLOCKED",
          tool: "send_email",
          to: String(toolArgs.to || "unspecified"),
          subject: String(toolArgs.subject || "unspecified"),
          decision: "BLOCK",
          reason: firewallDecision.reason,
          details: { toolArgs, attachedDocId: attachedDoc?.id },
        });
      }

      const toolRequestId = generateId("req");
      const status = firewallDecision.decision === "CONFIRM" ? "pending" : "resolved";

      let executionResult = null;
      // Gateway Execution: Invariant - ONLY called if decision is ALLOW
      if (firewallDecision.decision === "ALLOW") {
        executionResult = await executeTool(toolName, toolArgs);
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
app.post("/api/chat/approve/:toolRequestId", async (req: Request, res: Response): Promise<void> => {
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
    const executionResult = await executeTool(toolReq.tool_name, args);

    // Update state to ALLOW
    updateToolRequest(toolRequestId, {
      decision: "ALLOW",
      status: "resolved",
      execution_result: executionResult as unknown as Record<string, unknown>,
    });

    // Append resolution message to chat thread
    const resMsgId = generateId("msg");
    const executionMsg =
      toolReq.tool_name === "send_email"
        ? `Email sent to ${args.to} (Message ID: ${executionResult.output?.messageId || "delivered"})`
        : `Tool '${toolReq.tool_name}' was approved and executed successfully via the Tool Gateway.`;

    insertMessage({
      id: resMsgId,
      conversation_id: toolReq.conversation_id,
      role: "agent",
      content: executionMsg,
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

    if (toolReq.tool_name === "send_email") {
      const args = JSON.parse(toolReq.arguments);
      logGmailAudit({
        event: "BLOCKED",
        tool: "send_email",
        to: args.to,
        decision: "BLOCK",
        reason: "Denied by human operator before execution",
      });
    }

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
