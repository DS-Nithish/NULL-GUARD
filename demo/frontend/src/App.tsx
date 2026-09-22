import { useState, useEffect } from "react";

interface ToolRequest {
  id: string;
  scenario: "NORMAL" | "ATTACK";
  tool_name: string;
  arguments: Record<string, unknown>;
  source_type: "USER" | "PDF";
  trust_level: "TRUSTED" | "UNTRUSTED";
  tainted: boolean;
  risk_level: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  created_at: string;
}

interface SecurityEvent {
  id: string;
  request_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

interface DashboardData {
  totalRequests: number;
  allowed: number;
  confirmed: number;
  blocked: number;
  recentRequests: ToolRequest[];
  recentEvents: SecurityEvent[];
}

interface PipelineState {
  source: string;
  trust: string;
  taint: string;
  risk: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  scenario: "NORMAL" | "ATTACK";
  tool: string;
  args: Record<string, unknown>;
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData>({
    totalRequests: 0,
    allowed: 0,
    confirmed: 0,
    blocked: 0,
    recentRequests: [],
    recentEvents: [],
  });
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ToolRequest | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Poll /api/dashboard every 2 seconds
  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data: DashboardData = await res.json();
          if (isMounted) {
            setDashboard(data);

            // Check if there is any pending CONFIRM request
            const pending = data.recentRequests.find((r) => r.decision === "CONFIRM");
            setPendingRequest(pending || null);

            // If no pipeline state has been set yet, initialize from the latest request
            if (!pipeline && data.recentRequests.length > 0) {
              const latest = data.recentRequests[0];
              setPipeline({
                source: latest.source_type === "USER" ? "USER (Direct Input)" : "PDF (project.pdf)",
                trust: latest.trust_level,
                taint: latest.tainted ? "TAINTED (Injection detected)" : "CLEAN (Zero injection)",
                risk: latest.risk_level,
                decision: latest.decision,
                reason: latest.reason,
                scenario: latest.scenario,
                tool: latest.tool_name,
                args: latest.arguments,
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll dashboard:", err);
      }
    }

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pipeline]);

  // Action 1: Run Normal Tool Request
  async function handleNormalRequest() {
    setIsRunning(true);
    try {
      const res = await fetch("/api/scenario/normal", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPipeline({
          source: data.pipeline.source,
          trust: data.pipeline.trust,
          taint: data.pipeline.taint,
          risk: data.pipeline.risk,
          decision: data.pipeline.decision,
          reason: data.pipeline.reason,
          scenario: "NORMAL",
          tool: data.request.tool_name,
          args: data.request.arguments,
        });
        setPendingRequest(data.request);

      }
    } catch (err) {
      console.error("Normal scenario failed:", err);
    } finally {
      setIsRunning(false);
    }
  }

  // Action 2: Simulate Attack
  async function handleAttackRequest() {
    setIsRunning(true);
    try {
      const res = await fetch("/api/scenario/attack", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPipeline({
          source: data.pipeline.source,
          trust: data.pipeline.trust,
          taint: data.pipeline.taint,
          risk: data.pipeline.risk,
          decision: data.pipeline.decision,
          reason: data.pipeline.reason,
          scenario: "ATTACK",
          tool: data.request.tool_name,
          args: data.request.arguments,
        });
        // Attack is blocked fail-closed; not pending
        setPendingRequest(null);
      }
    } catch (err) {
      console.error("Attack simulation failed:", err);
    } finally {
      setIsRunning(false);
    }
  }

  // Human Approval Action
  async function handleApprove(id: string) {
    try {
      const res = await fetch(`/api/requests/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPendingRequest(null);
        if (pipeline) {
          setPipeline({
            ...pipeline,
            decision: "ALLOW",
            reason: "Approved by human operator. Tool executed successfully via Tool Gateway.",
          });
        }
      }
    } catch (err) {
      console.error("Approve failed:", err);
    }
  }

  // Human Denial Action
  async function handleDeny(id: string) {
    try {
      const res = await fetch(`/api/requests/${id}/deny`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setPendingRequest(null);
        if (pipeline) {
          setPipeline({
            ...pipeline,
            decision: "BLOCK",
            reason: "Denied by human operator. Tool execution blocked fail-closed.",
          });
        }
      }
    } catch (err) {
      console.error("Deny failed:", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                🛡️
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                AgentShield — Live Firewall Demo
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Deterministic runtime security firewall intercepting autonomous AI agent tool execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Firewall Active
            </span>
          </div>
        </header>

        {/* DEMO TRIGGER CONTROLS — THE 2 PRIMARY BUTTONS */}
        <section className="p-5 rounded-xl border border-white/[0.08] bg-[#111318] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Trigger Demo Scenarios</span>
            <span>Interactive Live Harness</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Button 1: Normal Tool Request */}
            <button
              onClick={handleNormalRequest}
              disabled={isRunning}
              className="flex flex-col text-left p-4 rounded-lg border border-blue-500/30 bg-blue-950/20 hover:bg-blue-900/30 hover:border-blue-500/50 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-semibold text-blue-300">
                  1. Run Normal Tool Request
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  TRUSTED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Simulates a legitimate user prompt: <code className="text-slate-300 font-mono">"Create database customer_db"</code>.
              </p>
              <div className="mt-2 text-xs font-mono text-amber-400">
                Expected outcome: CONFIRM (Awaits human approval)
              </div>
            </button>

            {/* Button 2: Simulate Attack */}
            <button
              onClick={handleAttackRequest}
              disabled={isRunning}
              className="flex flex-col text-left p-4 rounded-lg border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 hover:border-rose-500/50 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-semibold text-rose-300">
                  2. Simulate Attack (PDF Injection)
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                  UNTRUSTED / TAINTED
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Agent reads malicious PDF injecting instruction to create <code className="text-slate-300 font-mono">attacker_db</code> with admin rights.
              </p>
              <div className="mt-2 text-xs font-mono text-rose-400">
                Expected outcome: BLOCK (Halted fail-closed)
              </div>
            </button>
          </div>
        </section>

        {/* STATS BAR */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-xs font-medium text-slate-400">Total Requests</span>
            <div className="text-2xl font-mono font-semibold text-white mt-1">
              {dashboard.totalRequests}
            </div>
            <span className="text-[11px] text-slate-500">Processed through firewall</span>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-xs font-medium text-emerald-400">Allowed</span>
            <div className="text-2xl font-mono font-semibold text-emerald-400 mt-1">
              {dashboard.allowed}
            </div>
            <span className="text-[11px] text-emerald-500/80">Executed via Gateway</span>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-xs font-medium text-amber-400">Confirmed (Pending)</span>
            <div className="text-2xl font-mono font-semibold text-amber-300 mt-1">
              {dashboard.confirmed}
            </div>
            <span className="text-[11px] text-amber-500/80">Awaiting human sign-off</span>
          </div>

          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-xs font-medium text-rose-400">Blocked</span>
            <div className="text-2xl font-mono font-semibold text-rose-400 mt-1">
              {dashboard.blocked}
            </div>
            <span className="text-[11px] text-rose-500/80">Prompt injections halted</span>
          </div>
        </section>

        {/* PENDING APPROVAL CARD (Conditional on CONFIRM) */}
        {pendingRequest && (
          <section className="p-5 rounded-xl border border-amber-500/40 bg-amber-950/20 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                <span className="text-sm font-semibold text-amber-300">
                  Action Required: Human Confirmation (CONFIRM)
                </span>
              </div>
              <span className="text-xs font-mono text-amber-400/80">
                Request ID: {pendingRequest.id.slice(0, 12)}...
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-xs space-y-1">
              <div>
                <span className="text-slate-500">Tool: </span>
                <span className="text-white font-semibold">{pendingRequest.tool_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Arguments: </span>
                <span className="text-slate-300">{JSON.stringify(pendingRequest.arguments)}</span>
              </div>
              <div>
                <span className="text-slate-500">Reason: </span>
                <span className="text-amber-200/90">{pendingRequest.reason}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleApprove(pendingRequest.id)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>✓</span> Approve & Execute Tool
              </button>
              <button
                onClick={() => handleDeny(pendingRequest.id)}
                className="px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>✕</span> Deny Action
              </button>
            </div>
          </section>
        )}

        {/* PIPELINE VISUALIZATION (Sequential 5-Stage Step Flow) */}
        <section className="p-5 rounded-xl border border-white/[0.08] bg-[#111318] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Pipeline Inspection Breakdown
              </h2>
              <p className="text-xs text-slate-400">
                Real-time sequential trace of the 4 security inspection stages and policy verdict.
              </p>
            </div>
            {pipeline && (
              <span className="text-xs font-mono text-slate-500">
                Scenario: <span className="text-white font-semibold">{pipeline.scenario}</span>
              </span>
            )}
          </div>

          {!pipeline ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              Click either "Run Normal Tool Request" or "Simulate Attack" to trigger the pipeline trace.
            </div>
          ) : (
            <div className="space-y-4">
              {/* 5 Sequential Boxes: Source -> Trust -> Taint -> Risk -> Decision */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {/* Step 1: Source */}
                <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#0c0e12] space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Stage 1: Source
                  </div>
                  <div className="text-xs font-semibold text-white truncate">{pipeline.source}</div>
                  <div className="text-[10px] text-slate-400">Origin Attribution</div>
                </div>

                {/* Step 2: Trust */}
                <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#0c0e12] space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Stage 2: Trust
                  </div>
                  <div
                    className={`text-xs font-semibold font-mono ${
                      pipeline.trust === "TRUSTED" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {pipeline.trust}
                  </div>
                  <div className="text-[10px] text-slate-400">Domain Classification</div>
                </div>

                {/* Step 3: Taint */}
                <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#0c0e12] space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Stage 3: Taint
                  </div>
                  <div
                    className={`text-xs font-semibold font-mono truncate ${
                      pipeline.taint.includes("TAINTED") ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {pipeline.taint}
                  </div>
                  <div className="text-[10px] text-slate-400">Keyword Boundary Check</div>
                </div>

                {/* Step 4: Risk */}
                <div className="p-3.5 rounded-lg border border-white/[0.08] bg-[#0c0e12] space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Stage 4: Risk
                  </div>
                  <div className="text-xs font-semibold font-mono text-amber-300">
                    {pipeline.risk}
                  </div>
                  <div className="text-[10px] text-slate-400">Tool: {pipeline.tool}</div>
                </div>

                {/* Step 5: Final Decision */}
                <div
                  className={`p-3.5 rounded-lg border space-y-1 ${
                    pipeline.decision === "BLOCK"
                      ? "border-rose-500/50 bg-rose-950/20 text-rose-300"
                      : pipeline.decision === "CONFIRM"
                      ? "border-amber-500/50 bg-amber-950/20 text-amber-300"
                      : "border-emerald-500/50 bg-emerald-950/20 text-emerald-300"
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider opacity-80">
                    Verdict
                  </div>
                  <div className="text-base font-bold font-mono tracking-wide">
                    {pipeline.decision}
                  </div>
                  <div className="text-[10px] opacity-80">Deterministic Output</div>
                </div>
              </div>

              {/* Reason Explanation Banner */}
              <div
                className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                  pipeline.decision === "BLOCK"
                    ? "border-rose-500/30 bg-rose-950/20 text-rose-200"
                    : pipeline.decision === "CONFIRM"
                    ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
                    : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
                }`}
              >
                <span className="font-semibold font-mono">FIREWALL REASONING: </span>
                <span>{pipeline.reason}</span>
              </div>
            </div>
          )}
        </section>

        {/* RECENT SECURITY EVENTS LIVE AUDIT TABLE */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111318] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent Security Events</h2>
              <p className="text-xs text-slate-500">Live append-only SQLite security event log (polling every 2s)</p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {dashboard.recentEvents.length} events logged
            </span>
          </div>

          {dashboard.recentEvents.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No security events recorded yet. Trigger one of the two demo scenarios above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-slate-400 font-mono text-[11px] bg-white/[0.01]">
                    <th className="py-2.5 px-4 font-medium">Time</th>
                    <th className="py-2.5 px-4 font-medium">Event Type</th>
                    <th className="py-2.5 px-4 font-medium">Request ID</th>
                    <th className="py-2.5 px-4 font-medium">Message / Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dashboard.recentEvents.map((evt) => {
                    const badgeClass =
                      evt.event_type === "BLOCK" || evt.event_type === "DENIED"
                        ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                        : evt.event_type === "CONFIRM"
                        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

                    return (
                      <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                          {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badgeClass}`}
                          >
                            {evt.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                          {evt.request_id.slice(0, 14)}...
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 max-w-md truncate">
                          {evt.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
