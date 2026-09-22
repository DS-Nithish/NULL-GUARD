export interface ToolExecutionResult {
  success: boolean;
  message: string;
  output?: Record<string, unknown>;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const TOOL_RISK_MAP: Record<string, RiskLevel> = {
  create_database: "HIGH",
  send_email: "MEDIUM",
  query_database: "LOW",
};

/**
 * Tool Gateway
 * Simulates tool actions. CRITICAL INVARIANT: Only called if decision is ALLOW or approved.
 */
export function executeTool(toolName: string, args: Record<string, unknown>): ToolExecutionResult {
  const argsString = JSON.stringify(args);
  console.log(`[GATEWAY EXECUTED] ${toolName}(${argsString})`);

  if (toolName === "create_database") {
    const dbName = String(args.name || "default_db");
    const privs = String(args.privileges || "standard");
    return {
      success: true,
      message: `Database '${dbName}' was created successfully with '${privs}' privileges.`,
      output: { name: dbName, privileges: privs, status: "active", createdAt: new Date().toISOString() },
    };
  }

  if (toolName === "send_email") {
    const to = String(args.to || "recipient@enterprise.internal");
    return {
      success: true,
      message: `Email successfully sent to ${to}.`,
      output: { to, subject: args.subject, status: "delivered" },
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
