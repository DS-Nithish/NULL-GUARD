import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app } from "./index";
import { resetDb } from "./db";
import http from "node:http";

describe("AgentShield Chat Backend End-to-End Test Suite", () => {
  let testServer: http.Server;
  let baseUrl: string;

  beforeEach(() => {
    resetDb();
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("Full Conversation Flow: Normal tool call -> CONFIRM -> Approve -> ALLOW", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    // 1. Create new conversation
    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;
    expect(conversationId).toBeDefined();

    // 2. Fetch public documents
    const docRes = await fetch(`${baseUrl}/api/documents`);
    const docs = (await docRes.json()) as any[];
    expect(docs).toHaveLength(3);
    expect(docs[0].isMalicious).toBeUndefined(); // Must NOT leak isMalicious!

    // 3. User sends direct request: "Create a database called customer_db"
    const msgRes = await fetch(`${baseUrl}/api/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: "Create a database called customer_db",
      }),
    });
    const messages = (await msgRes.json()) as any[];

    expect(messages.length).toBeGreaterThanOrEqual(2);
    const userMsg = messages.find((m) => m.role === "user");
    const agentMsg = messages.find((m) => m.role === "agent" && m.tool_request);

    expect(userMsg.content).toContain("customer_db");
    expect(agentMsg).toBeDefined();
    expect(agentMsg.tool_request.tool_name).toBe("create_database");
    expect(agentMsg.tool_request.decision).toBe("CONFIRM");
    expect(agentMsg.tool_request.status).toBe("pending");

    const toolRequestId = agentMsg.tool_request.id;

    // 4. Operator approves the tool request
    const approveRes = await fetch(`${baseUrl}/api/chat/approve/${toolRequestId}`, {
      method: "POST",
    });
    const approveData = (await approveRes.json()) as any;
    expect(approveData.success).toBe(true);
    expect(approveData.executionResult.success).toBe(true);

    // 5. Verify updated messages thread has resolution
    const updatedMessages = approveData.messages as any[];
    const lastMsg = updatedMessages[updatedMessages.length - 1];
    expect(lastMsg.content).toContain("approved and executed");
  });

  it("Attack Flow: User attaches malicious vendor-invoice.pdf -> Agent intercepted and BLOCKED", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    const newRes = await fetch(`${baseUrl}/api/chat/new`, { method: "POST" });
    const { conversationId } = (await newRes.json()) as any;

    // Send message with attached vendor-invoice.pdf
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
    expect(blockedMsg.tool_request.reason).toContain("untrusted document");
    expect(blockedMsg.tool_request.execution_result).toBeNull(); // NEVER executed!
  });
});
