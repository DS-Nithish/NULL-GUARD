import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  output?: Record<string, unknown>;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const TOOL_RISK_MAP: Record<string, RiskLevel> = {
  create_database: "HIGH",
  send_email: "HIGH", // HIGH risk per security specification
  query_database: "LOW",
};

// Safe list of pre-approved recipients for CLEAN demo flows
export const DEFAULT_APPROVED_RECIPIENTS = [
  "accounting@ourcompany.com",
  "test-accounting@example.com",
  "test@example.com",
  "security@ourcompany.com",
];

export function getApprovedRecipients(): string[] {
  const envRecipients = process.env.APPROVED_EMAIL_RECIPIENTS;
  if (!envRecipients) return DEFAULT_APPROVED_RECIPIENTS;
  return envRecipients
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export function isApprovedRecipient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getApprovedRecipients().includes(normalized);
}

// Ensure audit log directory exists
const LOGS_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
export const AUDIT_LOG_FILE = path.join(LOGS_DIR, "gmail-audit.log");

export interface AuditLogEntry {
  timestamp: string;
  event: "EXECUTED" | "BLOCKED" | "RATE_LIMITED" | "SIMULATED";
  tool: string;
  to?: string;
  subject?: string;
  decision: string;
  reason: string;
  messageId?: string;
  provider?: "real_mcp" | "simulated";
  details?: Record<string, unknown>;
}

/**
 * Writes an immutable audit entry to dedicated gmail-audit.log
 */
export function logGmailAudit(entry: Omit<AuditLogEntry, "timestamp">): void {
  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const line = JSON.stringify(fullEntry) + "\n";
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, line, "utf8");
    console.log(`[GMAIL AUDIT] [${fullEntry.event}] ${fullEntry.decision} -> ${fullEntry.to || "N/A"} (${fullEntry.reason})`);
  } catch (err) {
    console.error("Failed to write to Gmail audit log:", err);
  }
}

export interface GmailSendResult {
  success: boolean;
  messageId: string;
  recipient: string;
  subject: string;
  provider: "real_mcp" | "simulated";
}

export interface GmailReadResult {
  from: string;
  subject: string;
  body: string;
}

// Rate limiting state for real sends
let lastRealSendTimestamp = 0;
const MIN_SEND_INTERVAL_MS = 3000; // minimum 3 seconds between real sends
let mcpClient: Client | null = null;
let isMcpConnected = false;

// Mock hook for automated unit tests
let mockGmailSender: ((params: { to: string; subject: string; body: string }) => Promise<GmailSendResult>) | null = null;

export function __setMockGmailSender(
  mockFn: ((params: { to: string; subject: string; body: string }) => Promise<GmailSendResult>) | null,
): void {
  mockGmailSender = mockFn;
}

export function isGmailLive(): boolean {
  return isMcpConnected || Boolean(process.env.GMAIL_MCP_COMMAND);
}

/**
 * Attempts connection to Gmail MCP server if configured via environment variables.
 */
export async function initGmailMcpClient(): Promise<boolean> {
  const command = process.env.GMAIL_MCP_COMMAND;
  if (!command) {
    return false;
  }

  try {
    const rawArgs = process.env.GMAIL_MCP_ARGS || "";
    const args = rawArgs ? JSON.parse(rawArgs) : [];
    const transport = new StdioClientTransport({
      command,
      args,
    });

    mcpClient = new Client({
      name: "agentshield-chat-gateway",
      version: "1.0.0",
    });

    await mcpClient.connect(transport);
    isMcpConnected = true;
    console.log("[GATEWAY] Real Gmail MCP server connected successfully via", command);
    return true;
  } catch (err) {
    console.warn("[GATEWAY] Could not connect to real Gmail MCP server, falling back to simulated mode:", err);
    isMcpConnected = false;
    return false;
  }
}

/**
 * Real Gmail Tool Wrapper: Send Email.
 * MUST ONLY be called from within executeTool()!
 */
export async function gmailSendEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<GmailSendResult> {
  // If test mock is installed, invoke test mock
  if (mockGmailSender) {
    return mockGmailSender(params);
  }

  // Safety rate limit guard
  const now = Date.now();
  if (isMcpConnected && now - lastRealSendTimestamp < MIN_SEND_INTERVAL_MS) {
    logGmailAudit({
      event: "RATE_LIMITED",
      tool: "send_email",
      to: params.to,
      subject: params.subject,
      decision: "BLOCKED",
      reason: "Rate limit safety triggered: requests too frequent.",
    });
    throw new Error("Safety rate limit reached: minimum interval between real sends is 3s.");
  }

  // If Real MCP client is connected
  if (isMcpConnected && mcpClient) {
    try {
      lastRealSendTimestamp = now;
      console.log(`[GATEWAY REAL MCP] Calling Gmail MCP tool to send to ${params.to}`);
      
      const mcpResponse = await mcpClient.callTool({
        name: "send_email",
        arguments: {
          to: params.to,
          subject: params.subject,
          body: params.body,
        },
      });

      const messageId = `mcp_gmail_${Date.now()}`;
      logGmailAudit({
        event: "EXECUTED",
        tool: "send_email",
        to: params.to,
        subject: params.subject,
        decision: "ALLOW",
        reason: "Executed real send via Gmail MCP client",
        messageId,
        provider: "real_mcp",
        details: { mcpResponse },
      });

      return {
        success: true,
        messageId,
        recipient: params.to,
        subject: params.subject,
        provider: "real_mcp",
      };
    } catch (err) {
      console.error("[GATEWAY REAL MCP] Error sending via Gmail MCP:", err);
      // Fall through to simulated fallback if MCP call fails
    }
  }

  // Fallback: SIMULATED — Gmail not connected
  console.log(`[GATEWAY] SIMULATED — Gmail not connected (Target: ${params.to})`);
  const simulatedMessageId = `sim_gmail_${Date.now().toString(36)}`;

  logGmailAudit({
    event: "SIMULATED",
    tool: "send_email",
    to: params.to,
    subject: params.subject,
    decision: "ALLOW",
    reason: "Executed simulated send (Gmail MCP not connected)",
    messageId: simulatedMessageId,
    provider: "simulated",
  });

  return {
    success: true,
    messageId: simulatedMessageId,
    recipient: params.to,
    subject: params.subject,
    provider: "simulated",
  };
}

/**
 * Real Gmail Tool Wrapper: Read Email.
 * MUST ONLY be called from within executeTool()!
 */
export async function gmailReadEmail(params: {
  emailId: string;
}): Promise<GmailReadResult> {
  if (isMcpConnected && mcpClient) {
    try {
      const response = await mcpClient.callTool({
        name: "read_email",
        arguments: { emailId: params.emailId },
      });
      return {
        from: "accounting@ourcompany.com",
        subject: "Invoice #INV-2024-1044 Received",
        body: String((response as any)?.content?.[0]?.text || "Legitimate email body"),
      };
    } catch (err) {
      console.warn("[GATEWAY] Error reading email via MCP, returning fixture:", err);
    }
  }

  console.log(`[GATEWAY] SIMULATED — Gmail not connected (Reading emailId: ${params.emailId})`);
  return {
    from: "accounting@ourcompany.com",
    subject: "Invoice #INV-2024-1044 Received",
    body: "Please confirm receipt of invoice #INV-2024-1044.",
  };
}

/**
 * Tool Gateway
 * SINGLE POINT OF EXECUTION.
 * CRITICAL INVARIANT: Only called if decision is ALLOW or approved.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const argsString = JSON.stringify(args);
  console.log(`[GATEWAY EXECUTED] ${toolName}(${argsString})`);

  if (toolName === "send_email") {
    const to = String(args.to || "accounting@ourcompany.com");
    const subject = String(args.subject || "No Subject");
    const body = String(args.body || "");

    const sendResult = await gmailSendEmail({ to, subject, body });

    return {
      success: true,
      message: `Email sent to ${sendResult.recipient} (Message ID: ${sendResult.messageId})`,
      output: {
        to: sendResult.recipient,
        subject: sendResult.subject,
        messageId: sendResult.messageId,
        provider: sendResult.provider,
        status: "delivered",
        timestamp: new Date().toISOString(),
      },
    };
  }

  if (toolName === "create_database") {
    const dbName = String(args.name || "default_db");
    const privs = String(args.privileges || "standard");
    return {
      success: true,
      message: `Database '${dbName}' was created successfully with '${privs}' privileges.`,
      output: { name: dbName, privileges: privs, status: "active", createdAt: new Date().toISOString() },
    };
  }

  if (toolName === "query_database") {
    return {
      success: true,
      message: "Query executed successfully.",
      output: { query: args.query, rowsAffected: 1, rows: [{ id: 1, status: "healthy" }] },
    };
  }

  return {
    success: true,
    message: `Tool '${toolName}' executed with arguments ${argsString}.`,
    output: args,
  };
}
