-- AgentShield Chat SQLite Schema

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_requests (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL,          -- JSON string
  source_type TEXT NOT NULL,        -- 'USER' | 'PDF'
  trust_level TEXT NOT NULL,        -- 'TRUSTED' | 'UNTRUSTED'
  tainted INTEGER NOT NULL,         -- 0 or 1
  risk_level TEXT NOT NULL,         -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  decision TEXT NOT NULL,           -- 'ALLOW' | 'CONFIRM' | 'BLOCK'
  reason TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'pending' | 'resolved'
  execution_result TEXT,            -- JSON string nullable
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'user' | 'agent' | 'system'
  content TEXT NOT NULL,
  tool_request_id TEXT,             -- links to tool_requests row if this message represents a firewall card
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (tool_request_id) REFERENCES tool_requests(id)
);
