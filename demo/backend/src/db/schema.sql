-- SQLite Schema for AgentShield Live Firewall Demo

CREATE TABLE IF NOT EXISTS tool_requests (
  id TEXT PRIMARY KEY,
  scenario TEXT NOT NULL,           -- 'NORMAL' | 'ATTACK'
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL,          -- JSON string
  source_type TEXT NOT NULL,        -- 'USER' | 'PDF'
  trust_level TEXT NOT NULL,        -- 'TRUSTED' | 'UNTRUSTED'
  tainted INTEGER NOT NULL,         -- 0 or 1
  risk_level TEXT NOT NULL,         -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  decision TEXT NOT NULL,           -- 'ALLOW' | 'CONFIRM' | 'BLOCK'
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,         -- 'ALLOW' | 'CONFIRM' | 'BLOCK' | 'APPROVED' | 'DENIED'
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES tool_requests(id)
);
