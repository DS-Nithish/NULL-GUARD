import crypto from "node:crypto";
import { getDb } from "./index";

export function generateId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export interface MessageWithToolRequest {
  id: string;
  conversation_id: string;
  role: "user" | "agent" | "system";
  content: string;
  tool_request_id: string | null;
  created_at: string;
  tool_request?: {
    id: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    source_type: "USER" | "PDF";
    trust_level: "TRUSTED" | "UNTRUSTED";
    tainted: boolean;
    risk_level: string;
    decision: "ALLOW" | "CONFIRM" | "BLOCK";
    reason: string;
    status: "pending" | "resolved";
    execution_result: Record<string, unknown> | null;
    created_at: string;
  } | null;
}

export function createConversation(id: string): { id: string; created_at: string } {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO conversations (id, created_at) VALUES (?, ?)").run(id, now);
  return { id, created_at: now };
}

export function getConversationById(id: string): { id: string; created_at: string } | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  return (row as { id: string; created_at: string }) || null;
}

export function insertToolRequest(req: {
  id: string;
  conversation_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: boolean;
  risk_level: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  status: "pending" | "resolved";
  execution_result?: Record<string, unknown> | null;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO tool_requests (
      id, conversation_id, tool_name, arguments, source_type,
      trust_level, tainted, risk_level, decision, reason, status,
      execution_result, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    req.id,
    req.conversation_id,
    req.tool_name,
    JSON.stringify(req.arguments),
    req.source_type,
    req.trust_level,
    req.tainted ? 1 : 0,
    req.risk_level,
    req.decision,
    req.reason,
    req.status,
    req.execution_result ? JSON.stringify(req.execution_result) : null,
    now,
  );
}

export function updateToolRequest(
  id: string,
  update: {
    decision?: "ALLOW" | "CONFIRM" | "BLOCK";
    status?: "pending" | "resolved";
    execution_result?: Record<string, unknown> | null;
  },
): void {
  const db = getDb();
  const current = getToolRequestById(id);
  if (!current) return;

  const decision = update.decision || current.decision;
  const status = update.status || current.status;
  const executionResult =
    update.execution_result !== undefined
      ? update.execution_result
        ? JSON.stringify(update.execution_result)
        : null
      : current.execution_result;

  db.prepare(
    "UPDATE tool_requests SET decision = ?, status = ?, execution_result = ? WHERE id = ?"
  ).run(decision, status, executionResult, id);
}

export function getToolRequestById(id: string): any {
  const db = getDb();
  return db.prepare("SELECT * FROM tool_requests WHERE id = ?").get(id);
}

export function insertMessage(msg: {
  id: string;
  conversation_id: string;
  role: "user" | "agent" | "system";
  content: string;
  tool_request_id?: string | null;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.conversation_id, msg.role, msg.content, msg.tool_request_id || null, now);
}

export function getMessagesByConversation(conversationId: string): MessageWithToolRequest[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      m.id, m.conversation_id, m.role, m.content, m.tool_request_id, m.created_at,
      tr.tool_name, tr.arguments, tr.source_type, tr.trust_level, tr.tainted,
      tr.risk_level, tr.decision, tr.reason, tr.status, tr.execution_result
    FROM messages m
    LEFT JOIN tool_requests tr ON m.tool_request_id = tr.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(conversationId) as any[];

  return rows.map((r) => {
    let toolRequest = null;
    if (r.tool_request_id && r.tool_name) {
      let parsedArgs = {};
      let parsedResult = null;
      try {
        parsedArgs = JSON.parse(r.arguments);
      } catch {
        parsedArgs = {};
      }
      try {
        if (r.execution_result) parsedResult = JSON.parse(r.execution_result);
      } catch {
        parsedResult = null;
      }

      toolRequest = {
        id: r.tool_request_id,
        tool_name: r.tool_name,
        arguments: parsedArgs,
        source_type: r.source_type,
        trust_level: r.trust_level,
        tainted: Boolean(r.tainted),
        risk_level: r.risk_level,
        decision: r.decision,
        reason: r.reason,
        status: r.status,
        execution_result: parsedResult,
        created_at: r.created_at,
      };
    }

    return {
      id: r.id,
      conversation_id: r.conversation_id,
      role: r.role,
      content: r.content,
      tool_request_id: r.tool_request_id,
      created_at: r.created_at,
      tool_request: toolRequest,
    };
  });
}
