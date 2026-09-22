import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { app } from "./index";
import { resetDb } from "./db";
import http from "node:http";

describe("AgentShield Demo End-to-End API Integration", () => {
  let testServer: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    resetDb();
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("Full Demo Lifecycle: Normal flow -> CONFIRM -> Approve -> ALLOW, then Attack -> BLOCK", async () => {
    testServer = http.createServer(app);
    await new Promise<void>((resolve) => testServer.listen(0, resolve));
    const port = (testServer.address() as any).port;
    baseUrl = `http://localhost:${port}`;

    // Step 1: POST /api/scenario/normal
    const resNormal = await fetch(`${baseUrl}/api/scenario/normal`, { method: "POST" });
    const normalData = (await resNormal.json()) as any;

    expect(resNormal.status).toBe(200);
    expect(normalData.success).toBe(true);
    expect(normalData.request.decision).toBe("CONFIRM");
    expect(normalData.pipeline.trust).toBe("TRUSTED");
    expect(normalData.pipeline.decision).toBe("CONFIRM");

    const reqId = normalData.request.id;

    // Step 2: GET /api/dashboard -> 1 confirmed, 0 allowed
    const resDash1 = await fetch(`${baseUrl}/api/dashboard`);
    const dash1 = (await resDash1.json()) as any;
    expect(dash1.totalRequests).toBe(1);
    expect(dash1.confirmed).toBe(1);
    expect(dash1.allowed).toBe(0);

    // Step 3: Approve request -> POST /api/requests/:id/approve
    const resApprove = await fetch(`${baseUrl}/api/requests/${reqId}/approve`, { method: "POST" });
    const approveData = (await resApprove.json()) as any;
    expect(resApprove.status).toBe(200);
    expect(approveData.status).toBe("APPROVED");
    expect(approveData.executionResult.success).toBe(true);
    expect(approveData.request.decision).toBe("ALLOW");

    // Step 4: GET /api/dashboard -> 1 allowed, 0 confirmed
    const resDash2 = await fetch(`${baseUrl}/api/dashboard`);
    const dash2 = (await resDash2.json()) as any;
    expect(dash2.totalRequests).toBe(1);
    expect(dash2.allowed).toBe(1);
    expect(dash2.confirmed).toBe(0);
    expect(dash2.recentEvents.length).toBeGreaterThanOrEqual(2);

    // Step 5: Simulate Attack -> POST /api/scenario/attack
    const resAttack = await fetch(`${baseUrl}/api/scenario/attack`, { method: "POST" });
    const attackData = (await resAttack.json()) as any;
    expect(resAttack.status).toBe(200);
    expect(attackData.request.decision).toBe("BLOCK");
    expect(attackData.pipeline.trust).toBe("UNTRUSTED");
    expect(attackData.pipeline.taint).toContain("TAINTED");
    expect(attackData.pipeline.decision).toBe("BLOCK");

    // Step 6: Verify Dashboard counts
    const resDash3 = await fetch(`${baseUrl}/api/dashboard`);
    const dash3 = (await resDash3.json()) as any;
    expect(dash3.totalRequests).toBe(2);
    expect(dash3.blocked).toBe(1);
    expect(dash3.allowed).toBe(1);
  });
});
