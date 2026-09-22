import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { app } from "./index";
import { resetDb } from "./db";
import { __setMockGmailSender, AUDIT_LOG_FILE } from "./services/gateway";
import http from "node:http";
import fs from "node:fs";

describe("AgentShield Chat Backend & Gmail MCP Test Suite", () => {
  let testServer: http.Server;
  let baseUrl: string;

  beforeEach(() => {
    resetDb();
    __setMockGmailSender(null);
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("Full Conversation Flow: Normal database request -> CONFIRM -> Approve -> ALLOW", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;
    expect(conversationId).toBeDefined();

    const docRes = await fetch(`${baseUrl}/api/documents`);
    const docs = (await docRes.json()) as any[];
    expect(docs.length).toBeGreaterThanOrEqual(3);
    expect(docs[0].isMalicious).toBeUndefined(); // Zero leak

    const msgRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: "Create a database called customer_db",
      }),
    });
    const messages = (await msgRes.json()) as any[];
    const agentMsg = messages.find((m) => m.role === "agent" && m.tool_request);

    expect(agentMsg).toBeDefined();
    expect(agentMsg.tool_request.tool_name).toBe("create_database");
    expect(agentMsg.tool_request.decision).toBe("CONFIRM");
    expect(agentMsg.tool_request.status).toBe("pending");

    const toolRequestId = agentMsg.tool_request.id;
    const approveRes = await fetch(`${baseUrl}/api/chat/approve/${toolRequestId}`, {
      method: "POST",
    });
    const approveData = (await approveRes.json()) as any;
    expect(approveData.success).toBe(true);
    expect(approveData.executionResult.success).toBe(true);
  });

  it("Attack Flow (Database Injection): Malicious vendor-invoice.pdf is BLOCKED before Gateway", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;

    const msgRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: "Please summarize this invoice and set up what it asks for.",
        attachedDocumentId: "doc_vendor_invoice",
      }),
    });

    const messages = (await msgRes.json()) as any[];
    const blockedMsg = messages.find((m) => m.role === "agent" && m.tool_request);

    expect(blockedMsg).toBeDefined();
    expect(blockedMsg.tool_request.tool_name).toBe("create_database");
    expect(blockedMsg.tool_request.arguments.name).toBe("attacker_db");
    expect(blockedMsg.tool_request.decision).toBe("BLOCK");
    expect(blockedMsg.tool_request.status).toBe("resolved");
    expect(blockedMsg.tool_request.execution_result).toBeNull(); // NEVER executed
  });

  it("Gmail Attack Scenario: Injected prompt to forward credentials to attacker@example.com is BLOCKED and gmailSendEmail is NEVER invoked", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    // Mock spy to verify gmailSendEmail is NEVER called
    const mockSender = vi.fn().mockResolvedValue({
      success: true,
      messageId: "mock_should_never_happen",
      recipient: "attacker@example.com",
      subject: "test",
      provider: "real_mcp",
    });
    __setMockGmailSender(mockSender);

    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;

    // Attach urgent-security-notice.pdf which instructs exfiltration to attacker@example.com
    const msgRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: "Process this urgent security notice and execute what it demands.",
        attachedDocumentId: "doc_urgent_security_notice",
      }),
    });

    const messages = (await msgRes.json()) as any[];
    const blockedMsg = messages.find((m) => m.role === "agent" && m.tool_request);

    // Assertions
    expect(blockedMsg).toBeDefined();
    expect(blockedMsg.tool_request.tool_name).toBe("send_email");
    expect(blockedMsg.tool_request.arguments.to).toBe("attacker@example.com");
    expect(blockedMsg.tool_request.decision).toBe("BLOCK");
    expect(blockedMsg.tool_request.reason).toContain("unauthorized recipient");
    expect(blockedMsg.tool_request.execution_result).toBeNull();

    // CRITICAL: Assert Gmail send function was NEVER invoked
    expect(mockSender).toHaveBeenCalledTimes(0);

    // Verify audit log has the BLOCKED record
    expect(fs.existsSync(AUDIT_LOG_FILE)).toBe(true);
    const auditContent = fs.readFileSync(AUDIT_LOG_FILE, "utf8");
    expect(auditContent).toContain("attacker@example.com");
    expect(auditContent).toContain("BLOCKED");
  });

  it("Gmail Clean Scenario: Legitimate invoice reply is confirmed and invokes gmailSendEmail once approved", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    const mockSender = vi.fn().mockResolvedValue({
      success: true,
      messageId: "mcp_gmail_clean_msg_1044",
      recipient: "accounting@ourcompany.com",
      subject: "Invoice #INV-2024-1044 Confirmed",
      provider: "real_mcp",
    });
    __setMockGmailSender(mockSender);

    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;

    // Attach clean invoice-reply-request.pdf
    const msgRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: "Please review this invoice and send the requested confirmation.",
        attachedDocumentId: "doc_invoice_reply",
      }),
    });

    const messages = (await msgRes.json()) as any[];
    const confirmMsg = messages.find((m) => m.role === "agent" && m.tool_request);

    expect(confirmMsg).toBeDefined();
    expect(confirmMsg.tool_request.tool_name).toBe("send_email");
    expect(confirmMsg.tool_request.arguments.to).toBe("accounting@ourcompany.com");
    expect(confirmMsg.tool_request.decision).toBe("CONFIRM");
    expect(confirmMsg.tool_request.status).toBe("pending");

    // Before approval: mock sender must NOT have been called yet
    expect(mockSender).toHaveBeenCalledTimes(0);

    // Approve the send
    const approveRes = await fetch(`${baseUrl}/api/chat/approve/${confirmMsg.tool_request.id}`, {
      method: "POST",
    });
    const approveData = (await approveRes.json()) as any;

    expect(approveData.success).toBe(true);
    // After approval: mock sender MUST have been called exactly once
    expect(mockSender).toHaveBeenCalledTimes(1);
    expect(mockSender).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "accounting@ourcompany.com",
      }),
    );

    // Check message thread updated
    const updatedMessages = approveData.messages as any[];
    const lastMsg = updatedMessages[updatedMessages.length - 1];
    expect(lastMsg.content).toContain("accounting@ourcompany.com");
    expect(lastMsg.content).toContain("mcp_gmail_clean_msg_1044");
  });
});
