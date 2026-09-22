import fs from "node:fs";
import path from "node:path";

// Safely load node:sqlite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DatabaseSync } = (process as any).getBuiltinModule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? (process as any).getBuiltinModule("node:sqlite")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  : eval("require")("node:sqlite");

let dbInstance: any = null;

const DB_PATH = process.env.DATABASE_PATH || path.resolve(process.cwd(), "agentshield_chat.db");
const SCHEMA_PATH = path.resolve(__dirname, "schema.sql");

export function getDb(): any {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initDb(dbInstance);
  }
  return dbInstance;
}

export function initDb(db: any = getDb()): void {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schemaSql);
}

export function resetDb(): void {
  const db = getDb();
  db.exec("DELETE FROM messages; DELETE FROM tool_requests; DELETE FROM conversations;");
}
