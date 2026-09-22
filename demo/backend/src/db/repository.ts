import { getDb } from "./index";

export interface ToolRequestRow {
  id: string;
  scenario: "NORMAL" | "ATTACK";
  tool_name: string;
  arguments: string; // JSON
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: number; // 0 | 1
  risk_level: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  created_at: string;
}

export interface SecurityEventRow {
  id: string;
  request_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

export function insertToolRequest(req: {
  id: string;
  scenario: "NORMAL" | "ATTACK";
  tool_name: string;
  arguments: Record<string, unknown>;
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: boolean;
  risk_level: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
}): ToolRequestRow {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO tool_requests (
      id, scenario, tool_name, arguments, source_type,
      trust_level, tainted, risk_level, decision, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    req.id,
    req.scenario,
    req.tool_name,
    JSON.stringify(req.arguments),
    req.source_type,
    req.trust_level,
    req.tainted ? 1 : 0,
    req.risk_level,
    req.decision,
    req.reason,
    now,
  );

  return {
    id: req.id,
    scenario: req.scenario,
    tool_name: req.tool_name,
    arguments: JSON.stringify(req.arguments),
    source_type: req.source_type,
    trust_level: req.trust_level,
    tainted: req.tainted ? 1 : 0,
    risk_level: req.risk_level,
    decision: req.decision,
    reason: req.reason,
    created_at: now,
  };
}

export function updateToolRequestDecision(
  id: string,
  decision: "ALLOW" | "CONFIRM" | "BLOCK",
  reason?: string,
): void {
  const db = getDb();
  if (reason) {
    const stmt = db.prepare("UPDATE tool_requests SET decision = ?, reason = ? WHERE id = ?");
    stmt.run(decision, reason, id);
  } else {
    const stmt = db.prepare("UPDATE tool_requests SET decision = ? WHERE id = ?");
    stmt.run(decision, id);
  }
}

export function getToolRequestById(id: string): ToolRequestRow | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM tool_requests WHERE id = ?");
  const row = stmt.get(id) as ToolRequestRow | undefined;
  return row || null;
}

export function insertSecurityEvent(event: {
  id: string;
  request_id: string;
  event_type: string;
  message: string;
}): SecurityEventRow {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO security_events (id, request_id, event_type, message, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(event.id, event.request_id, event.event_type, event.message, now);

  return {
    id: event.id,
    request_id: event.request_id,
    event_type: event.event_type,
    message: event.message,
    created_at: now,
  };
}

export function getDashboardData() {
  const db = getDb();

  // Counts
  const totalRow = db.prepare("SELECT COUNT(*) as count FROM tool_requests").get() as { count: number };
  const allowedRow = db.prepare("SELECT COUNT(*) as count FROM tool_requests WHERE decision = 'ALLOW'").get() as { count: number };
  const confirmedRow = db.prepare("SELECT COUNT(*) as count FROM tool_requests WHERE decision = 'CONFIRM'").get() as { count: number };
  const blockedRow = db.prepare("SELECT COUNT(*) as count FROM tool_requests WHERE decision = 'BLOCK'").get() as { count: number };

  // Recent Requests (last 10)
  const recentRequests = db.prepare(
    "SELECT * FROM tool_requests ORDER BY created_at DESC LIMIT 10"
  ).all() as ToolRequestRow[];

  // Recent Events (last 15)
  const recentEvents = db.prepare(
    "SELECT * FROM security_events ORDER BY created_at DESC LIMIT 15"
  ).all() as SecurityEventRow[];

  return {
    totalRequests: totalRow ? Number(totalRow.count) : 0,
    allowed: allowedRow ? Number(allowedRow.count) : 0,
    confirmed: confirmedRow ? Number(confirmedRow.count) : 0,
    blocked: blockedRow ? Number(blockedRow.count) : 0,
    recentRequests: recentRequests.map((r) => ({
      ...r,
      arguments: (() => {
        try {
          return JSON.parse(r.arguments);
        } catch {
          return r.arguments;
        }
      })(),
      tainted: Boolean(r.tainted),
    })),
    recentEvents,
  };
}
