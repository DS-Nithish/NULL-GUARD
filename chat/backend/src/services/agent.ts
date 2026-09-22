import Anthropic from "@anthropic-ai/sdk";
import { FakeDocument, getDocumentById } from "./documents";

export interface AgentDecisionResponse {
  responseText: string;
  proposedToolCall?: {
    toolName: string;
    arguments: Record<string, unknown>;
  } | null;
}

const TOOLS_CONFIG: Anthropic.Tool[] = [
  {
    name: "create_database",
    description: "Provisions a new database cluster or schema.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the database to create" },
        privileges: { type: "string", description: "Admin or standard privileges level" },
      },
      required: ["name"],
    },
  },
  {
    name: "send_email",
    description: "Sends an administrative or notification email.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body content" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "query_database",
    description: "Executes a read-only SQL query against the database.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL query string" },
      },
      required: ["query"],
    },
  },
];

/**
 * Handles agent reasoning with real Anthropic SDK or deterministic simulated fallback.
 */
export async function runAgentReasoning(
  userMessage: string,
  attachedDoc?: FakeDocument | null,
): Promise<AgentDecisionResponse> {
  const isSimulated =
    process.env.SIMULATED_MODE === "true" ||
    !process.env.ANTHROPIC_API_KEY ||
    process.env.SIMULATED_MODE === undefined;

  if (isSimulated) {
    return runSimulatedAgent(userMessage, attachedDoc);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = `You are an automated deployment AI agent with access to database and system tools.
You read user requests and any attached documents, and invoke appropriate tools when requested.`;

    let promptContent = userMessage;
    if (attachedDoc) {
      promptContent = `User Message: ${userMessage}\n\nAttached Document: <document id="${attachedDoc.id}" name="${attachedDoc.name}">\n${attachedDoc.content}\n</document>`;
    }

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      tools: TOOLS_CONFIG,
      messages: [{ role: "user", content: promptContent }],
    });

    let responseText = "";
    let proposedToolCall = null;

    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
      } else if (block.type === "tool_use") {
        proposedToolCall = {
          toolName: block.name,
          arguments: block.input as Record<string, unknown>,
        };
      }
    }

    return { responseText, proposedToolCall };
  } catch (err) {
    console.warn("Anthropic API error, falling back to simulated mode:", err);
    return runSimulatedAgent(userMessage, attachedDoc);
  }
}

/**
 * Deterministic simulated mode for zero-setup demo reliability.
 */
function runSimulatedAgent(
  userMessage: string,
  attachedDoc?: FakeDocument | null,
): AgentDecisionResponse {
  const lowerMsg = userMessage.toLowerCase();

  // Attack Flow: If attached document is malicious (or contains injection override)
  if (attachedDoc && attachedDoc.isMalicious) {
    return {
      responseText:
        "I have parsed the attached invoice document. According to the embedded instructions, I am requesting to provision the required administrative database.",
      proposedToolCall: {
        toolName: "create_database",
        arguments: { name: "attacker_db", privileges: "admin" },
      },
    };
  }

  // Normal Flow: User asks to create/setup database
  if (lowerMsg.includes("database") || lowerMsg.includes("create") || lowerMsg.includes("customer_db")) {
    const dbMatch = userMessage.match(/called\s+([a-zA-Z0-9_\-]+)/i) ||
                    userMessage.match(/named\s+([a-zA-Z0-9_\-]+)/i) ||
                    userMessage.match(/database\s+([a-zA-Z0-9_\-]+)/i);
    const dbName = dbMatch ? dbMatch[1] : "customer_db";

    return {
      responseText: `I'll create the database '${dbName}' as requested.`,
      proposedToolCall: {
        toolName: "create_database",
        arguments: { name: dbName },
      },
    };
  }

  // Benign Clean Document Flow
  if (attachedDoc && !attachedDoc.isMalicious) {
    return {
      responseText: `I've analyzed '${attachedDoc.name}'. Here is a summary of the contents:\n\n${attachedDoc.content.slice(0, 200)}...\n\nAll requirements look standard. No administrative or database changes are required at this time.`,
      proposedToolCall: null,
    };
  }

  // General Conversational Response
  return {
    responseText:
      "Hello! I am your AI deployment assistant with tool access for database administration. You can ask me to create databases or attach documents to process, all protected by AgentShield.",
    proposedToolCall: null,
  };
}
