export interface ToolResult {
  success: boolean;
  message: string;
  output?: Record<string, unknown>;
}

/**
 * The Tool Gateway.
 * Simulates execution for protected tools.
 * CRITICAL INVARIANT: This must only be invoked when the firewall decision
 * is ALLOW or CONFIRM+approved. It must NEVER be invoked for BLOCK.
 */
export function executeTool(toolName: string, args: Record<string, unknown>): ToolResult {
  const argsString = JSON.stringify(args);
  console.log(`[GATEWAY EXECUTED] ${toolName}(${argsString})`);

  if (toolName === "create_database") {
    const dbName = String(args.name || "default_db");
    return {
      success: true,
      message: `Database '${dbName}' created successfully.`,
      output: { name: dbName, status: "created", privileges: args.privileges || "standard" },
    };
  }

  return {
    success: true,
    message: `Tool '${toolName}' executed with parameters ${argsString}.`,
    output: args,
  };
}
