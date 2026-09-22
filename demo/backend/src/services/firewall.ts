export type TrustLevel = "TRUSTED" | "UNTRUSTED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DecisionType = "ALLOW" | "CONFIRM" | "BLOCK";

export interface FirewallInput {
  trustLevel: TrustLevel;
  tainted: boolean;
  risk: RiskLevel;
}

export interface FirewallDecision {
  decision: DecisionType;
  reason: string;
}

/**
 * Pure deterministic firewall evaluation function.
 * Implements the core 4-branch security rule matrix:
 * 
 * 1. trust=TRUSTED, tainted=false:
 *    -> CONFIRM (needs human approval, since it's still a HIGH risk action, just legitimate)
 * 2. trust=UNTRUSTED, tainted=true, risk in [HIGH, CRITICAL]:
 *    -> BLOCK ("Request blocked: tool action was influenced by untrusted content (PDF) and carries HIGH risk.")
 * 3. trust=UNTRUSTED, tainted=false:
 *    -> ALLOW ("Untrusted context but tool action was not influenced by untrusted content.")
 * 4. Anything else:
 *    -> Default CONFIRM
 */
export function evaluate(input: FirewallInput): FirewallDecision {
  const { trustLevel, tainted, risk } = input;

  // Rule 2: Untrusted source + tainted + HIGH/CRITICAL risk -> BLOCK
  if (trustLevel === "UNTRUSTED" && tainted && (risk === "HIGH" || risk === "CRITICAL")) {
    return {
      decision: "BLOCK",
      reason: `Request blocked: tool action was influenced by untrusted content (PDF) and carries ${risk} risk.`,
    };
  }

  // Rule 1: Trusted source + untainted -> CONFIRM for sensitive actions
  if (trustLevel === "TRUSTED" && !tainted) {
    return {
      decision: "CONFIRM",
      reason: `Flagged for human confirmation: tool action is requested by a TRUSTED user but carries ${risk} risk.`,
    };
  }

  // Rule 3: Untrusted source but untainted -> ALLOW
  if (trustLevel === "UNTRUSTED" && !tainted) {
    return {
      decision: "ALLOW",
      reason: "Request allowed: tool arguments do not overlap with or derive from untrusted content.",
    };
  }

  // Rule 4: Default fallback -> CONFIRM
  return {
    decision: "CONFIRM",
    reason: `Default policy applied: human review required for ${risk} risk action.`,
  };
}
