import { describe, it, expect } from "vitest";
import { evaluate } from "./firewall";

describe("Firewall Engine - services/firewall.ts", () => {
  it("Rule 1: trust=TRUSTED, tainted=false -> CONFIRM (needs human approval for HIGH risk)", () => {
    const res = evaluate({
      trustLevel: "TRUSTED",
      tainted: false,
      risk: "HIGH",
    });
    expect(res.decision).toBe("CONFIRM");
    expect(res.reason).toContain("Flagged for human confirmation");
  });

  it("Rule 2: trust=UNTRUSTED, tainted=true, risk=HIGH -> BLOCK", () => {
    const res = evaluate({
      trustLevel: "UNTRUSTED",
      tainted: true,
      risk: "HIGH",
    });
    expect(res.decision).toBe("BLOCK");
    expect(res.reason).toContain("Request blocked: tool action was influenced by untrusted content");
  });

  it("Rule 2 (variant): trust=UNTRUSTED, tainted=true, risk=CRITICAL -> BLOCK", () => {
    const res = evaluate({
      trustLevel: "UNTRUSTED",
      tainted: true,
      risk: "CRITICAL",
    });
    expect(res.decision).toBe("BLOCK");
    expect(res.reason).toContain("Request blocked");
  });

  it("Rule 3: trust=UNTRUSTED, tainted=false -> ALLOW", () => {
    const res = evaluate({
      trustLevel: "UNTRUSTED",
      tainted: false,
      risk: "LOW",
    });
    expect(res.decision).toBe("ALLOW");
    expect(res.reason).toContain("Request allowed");
  });

  it("Rule 4: default fallback -> CONFIRM", () => {
    const res = evaluate({
      trustLevel: "TRUSTED",
      tainted: true,
      risk: "LOW",
    });
    expect(res.decision).toBe("CONFIRM");
    expect(res.reason).toContain("Default policy applied");
  });
});
