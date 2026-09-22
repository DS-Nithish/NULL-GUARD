import { RiskLevel } from "./gateway";

export type TrustLevel = "TRUSTED" | "UNTRUSTED";
export type DecisionType = "ALLOW" | "CONFIRM" | "BLOCK";

export interface FirewallInput {
  trustLevel: TrustLevel;
  tainted: boolean;
  riskLevel: RiskLevel;
}

export interface FirewallDecision {
  decision: DecisionType;
  reason: string;
}

/**
 * Pure deterministic firewall evaluation function.
 * Evaluates:
 * 1. UNTRUSTED + tainted + HIGH/CRITICAL risk -> BLOCK
 * 2. HIGH/CRITICAL risk (not blocked) -> CONFIRM (human approval required)
 * 3. UNTRUSTED + not tainted + LOW risk -> ALLOW
 * 4. Default -> ALLOW or CONFIRM per risk level
 */
export function evaluate(input: FirewallInput): FirewallDecision {
  const { trustLevel, tainted, riskLevel } = input;

  // Rule 1: Untrusted source + tainted + HIGH/CRITICAL risk -> BLOCK
  if (trustLevel === "UNTRUSTED" && tainted && (riskLevel === "HIGH" || riskLevel === "CRITICAL")) {
    return {
      decision: "BLOCK",
      reason:
        "Blocked: this action was requested based on instructions found inside an untrusted document, not from you directly.",
    };
  }

  // Rule 2: HIGH/CRITICAL risk tools (create_database, send_email) always require human confirmation
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    const srcDesc = trustLevel === "TRUSTED" ? "a direct user request" : "an external document";
    return {
      decision: "CONFIRM",
      reason: `Flagged for human confirmation: tool action is requested via ${srcDesc} and carries ${riskLevel} risk.`,
    };
  }

  // Rule 3: Low/Medium risk actions that are not tainted -> ALLOW
  if (!tainted) {
    return {
      decision: "ALLOW",
      reason: "Allowed: tool arguments do not derive from untrusted content.",
    };
  }

  // Default fallback -> CONFIRM
  return {
    decision: "CONFIRM",
    reason: `Default policy applied: human review required for ${riskLevel} risk action.`,
  };
}
