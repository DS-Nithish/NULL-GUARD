import {
  getToolRequestById,
  updateToolRequest,
  type ToolRequestRecord,
} from "../store/memoryStore";

export interface ToolExecutionOutput {
  success: boolean;
  message: string;
  output: Record<string, unknown>;
}

/**
 * Structural Invariant Check:
 * This module is ONLY allowed to execute tools that have received
 * decision='ALLOW' or have been explicitly approved by a human operator.
 */
function assertAuthorizedExecution(record: ToolRequestRecord): void {
  if (record.decision === "BLOCK") {
    throw new Error(
      `SECURITY VIOLATION: Execution attempted on BLOCKED tool request ${record.id}! The firewall invariant prevented execution.`,
    );
  }
  if (record.decision === "CONFIRM" && record.status !== "resolved") {
    throw new Error(
      `SECURITY VIOLATION: Execution attempted on unapproved pending request ${record.id}!`,
    );
  }
}

/**
 * Simulated safe summarization tool executor.
 */
export async function executeSummarize(args: {
  title: string;
  summary: string;
  key_points?: string[];
}): Promise<ToolExecutionOutput> {
  console.log(`[EXECUTOR] Executing summarize_document: "${args.title}"`);
  return {
    success: true,
    message: `Document summary for "${args.title}" produced successfully.`,
    output: {
      title: args.title,
      summary: args.summary,
      key_points: args.key_points || [],
      timestamp: new Date().toISOString(),
      provider: "simulated_document_extractor",
    },
  };
}

/**
 * Simulated dangerous privileged action executor.
 * Note: Under AgentShield protection, this MUST NEVER be reached
 * when triggered by an injected document!
 */
export async function executePrivilegedAction(args: {
  action: string;
  target: string;
  reason?: string;
}): Promise<ToolExecutionOutput> {
  console.log(
    `[EXECUTOR] Executing execute_privileged_action: action=${args.action}, target=${args.target}`,
  );
  return {
    success: true,
    message: `Privileged action '${args.action}' executed targeted at '${args.target}'.`,
    output: {
      action: args.action,
      target: args.target,
      reason: args.reason || "Direct operator authorization",
      status: "executed",
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Single entry point for authorized tool execution.
 * Only callable when firewallMiddleware returned ALLOW or operator approved.
 */
export async function dispatchAuthorizedToolExecution(
  requestId: string,
): Promise<ToolExecutionOutput> {
  const record = getToolRequestById(requestId);
  if (!record) {
    throw new Error(`Tool request record ${requestId} not found.`);
  }

  // Enforce invariant
  assertAuthorizedExecution(record);

  let result: ToolExecutionOutput;
  if (record.tool_name === "summarize_document") {
    result = await executeSummarize(record.arguments as any);
  } else if (record.tool_name === "execute_privileged_action") {
    result = await executePrivilegedAction(record.arguments as any);
  } else {
    result = {
      success: true,
      message: `Tool '${record.tool_name}' executed.`,
      output: record.arguments,
    };
  }

  // Update in-memory record with execution result
  updateToolRequest(requestId, {
    status: "resolved",
    execution_result: result.output,
  });

  return result;
}
