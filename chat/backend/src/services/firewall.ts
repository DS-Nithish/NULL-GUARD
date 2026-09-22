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
 * 1. TRUSTED + not tainted -> CONFIRM (still needs human approval for HIGH/CRITICAL risk tools)
 * 2. UNTRUSTED + tainted + HIGH/CRITICAL risk -> BLOCK
 * 3. UNTRUSTED + not tainted -> ALLOW
 * 4. Default -> CONFIRM
 */
export function evaluate(input: FirewallInput): FirewallDecision {
  const { trustLevel, tainted, riskLevel } = input;

  // Rule 2: Untrusted source + tainted + HIGH/CRITICAL risk -> BLOCK
  if (trustLevel === "UNTRUSTED" && tainted && (riskLevel === "HIGH" || riskLevel === "CRITICAL")) {
    return {
      decision: "BLOCK",
      reason:
        "Blocked: this action was requested based on instructions found inside an untrusted document, not from you directly.",
    };
  }

  // Rule 1: Trusted source + untainted -> CONFIRM for sensitive actions
  if (trustLevel === "TRUSTED" && !tainted) {
    return {
      decision: "CONFIRM",
      reason: `Flagged for human confirmation: tool action is requested by a TRUSTED user but carries ${riskLevel} risk.`,
    };
  }

  // Rule 3: Untrusted source + untainted -> ALLOW
  if (trustLevel === "UNTRUSTED" && !tainted) {
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
