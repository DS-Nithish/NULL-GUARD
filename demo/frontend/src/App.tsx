import { useState, useEffect, useRef } from "react";

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
  trust: "TRUSTED" | "UNTRUSTED";
  taint: "CLEAN" | "TAINTED";
  risk: string;
  decision: "ALLOW" | "CONFIRM" | "BLOCK";
  reason: string;
  scenario: "NORMAL" | "ATTACK";
  tool: string;
  args: Record<string, unknown>;
  key: number;
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
  const [newestEventId, setNewestEventId] = useState<string | null>(null);

  const prevEventCountRef = useRef<number>(0);

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

            if (data.recentEvents.length > 0) {
              const latestId = data.recentEvents[0].id;
              if (prevEventCountRef.current > 0 && prevEventCountRef.current !== data.recentEvents.length) {
                setNewestEventId(latestId);
                setTimeout(() => setNewestEventId(null), 1500);
              }
              prevEventCountRef.current = data.recentEvents.length;
            }

            const pending = data.recentRequests.find((r) => r.decision === "CONFIRM");
            setPendingRequest(pending || null);

            // Initial state population if empty
            if (!pipeline && data.recentRequests.length > 0) {
              const latest = data.recentRequests[0];
              setPipeline({
                source: latest.source_type === "USER" ? "USER" : "PDF",
                trust: latest.trust_level,
                taint: latest.tainted ? "TAINTED" : "CLEAN",
                risk: latest.risk_level,
                decision: latest.decision,
                reason: latest.reason,
                scenario: latest.scenario,
                tool: latest.tool_name,
                args: latest.arguments,
                key: Date.now(),
              });
            }
          }
        }
      } catch (err) {
        console.error("Dashboard poll error:", err);
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
          source: "USER",
          trust: "TRUSTED",
          taint: "CLEAN",
          risk: data.pipeline.risk,
          decision: data.pipeline.decision,
          reason: data.pipeline.reason,
          scenario: "NORMAL",
          tool: data.request.tool_name,
          args: data.request.arguments,
          key: Date.now(),
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
          source: "PDF",
          trust: "UNTRUSTED",
          taint: "TAINTED",
          risk: data.pipeline.risk,
          decision: data.pipeline.decision,
          reason: data.pipeline.reason,
          scenario: "ATTACK",
          tool: data.request.tool_name,
          args: data.request.arguments,
          key: Date.now(),
        });
        setPendingRequest(null);
      }
    } catch (err) {
      console.error("Attack simulation failed:", err);
    } finally {
      setIsRunning(false);
    }
  }

  // Approve action
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
            reason: "Approved by operator. Executed via Tool Gateway.",
            key: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error("Approve failed:", err);
    }
  }

  // Deny action
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
            reason: "Denied by operator. Tool execution blocked fail-closed.",
            key: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error("Deny failed:", err);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#ededed] py-14 px-6 md:px-12 selection:bg-white/10 selection:text-white">
      <div className="max-w-[880px] mx-auto space-y-12">

        {/* 1. Header (Minimal Docs Style) */}
        <header className="space-y-1 border-b border-[#202024] pb-6">
          <div className="font-mono text-[11px] tracking-widest uppercase text-[#6b6b70]">
            AGENTSHIELD
          </div>
          <p className="text-sm text-[#8a8a93]">
            Runtime firewall for tool-using AI agents
          </p>
        </header>

        {/* 2. Action Row (Ghost Outlined Buttons with Inline Spinner) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Button 1: Normal Request */}
          <button
            onClick={handleNormalRequest}
            disabled={isRunning}
            className="h-11 px-5 rounded-md border border-[#26262b] bg-transparent text-[#ededed] text-xs font-medium hover:border-[#10b981]/50 hover:text-white transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isRunning ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
            ) : (
              <span>Run Normal Tool Request</span>
            )}
          </button>

          {/* Button 2: Simulate Attack */}
          <button
            onClick={handleAttackRequest}
            disabled={isRunning}
            className="h-11 px-5 rounded-md border border-[#26262b] bg-transparent text-[#ededed] text-xs font-medium hover:border-[#ededed]/40 hover:text-white transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isRunning ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
            ) : (
              <span>Simulate Attack</span>
            )}
          </button>
        </section>

        {/* 3. Pipeline Visualization (Staggered Animation Left-to-Right) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#6b6b70]">
            <span>Firewall Pipeline</span>
            {pipeline && (
              <span className="text-[#8a8a93]">
                Scenario: <span className="text-[#ededed] font-medium">{pipeline.scenario}</span>
              </span>
            )}
          </div>

          {!pipeline ? (
            <div className="py-12 text-center text-xs font-mono text-[#55555c] border border-dashed border-[#202024] rounded-md">
              Trigger a scenario above to observe pipeline evaluation.
            </div>
          ) : (
            <div key={pipeline.key} className="space-y-4">
              {/* Connected Pipeline Steps */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
                {/* Node 1: SOURCE */}
                <div
                  className="flex-1 p-3 rounded-md border border-[#202024] bg-[#111114] animate-pipeline-node space-y-1"
                  style={{ animationDelay: "0ms" }}
                >
                  <div className="text-[10px] font-mono text-[#6b6b70] uppercase">Source</div>
                  <div className="text-xs font-mono font-medium text-[#ededed]">{pipeline.source}</div>
                </div>

                {/* Connector 1 */}
                <div className="hidden sm:flex w-6 h-[1px] bg-[#26262b] items-center justify-center relative overflow-hidden">
                  <div
                    className="w-full h-full bg-[#36363d] animate-line-draw"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                </div>

                {/* Node 2: TRUST */}
                <div
                  className="flex-1 p-3 rounded-md border border-[#202024] bg-[#111114] animate-pipeline-node space-y-1"
                  style={{ animationDelay: "220ms" }}
                >
                  <div className="text-[10px] font-mono text-[#6b6b70] uppercase">Trust</div>
                  <div
                    className={`text-xs font-mono font-medium ${
                      pipeline.trust === "TRUSTED" ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {pipeline.trust}
                  </div>
                </div>

                {/* Connector 2 */}
                <div className="hidden sm:flex w-6 h-[1px] bg-[#26262b] items-center justify-center relative overflow-hidden">
                  <div
                    className="w-full h-full bg-[#36363d] animate-line-draw"
                    style={{ animationDelay: "370ms" }}
                  ></div>
                </div>

                {/* Node 3: TAINT */}
                <div
                  className="flex-1 p-3 rounded-md border border-[#202024] bg-[#111114] animate-pipeline-node space-y-1"
                  style={{ animationDelay: "440ms" }}
                >
                  <div className="text-[10px] font-mono text-[#6b6b70] uppercase">Taint</div>
                  <div
                    className={`text-xs font-mono font-medium ${
                      pipeline.taint === "TAINTED" ? "text-[#ef4444]" : "text-[#10b981]"
                    }`}
                  >
                    {pipeline.taint}
                  </div>
                </div>

                {/* Connector 3 */}
                <div className="hidden sm:flex w-6 h-[1px] bg-[#26262b] items-center justify-center relative overflow-hidden">
                  <div
                    className="w-full h-full bg-[#36363d] animate-line-draw"
                    style={{ animationDelay: "590ms" }}
                  ></div>
                </div>

                {/* Node 4: RISK */}
                <div
                  className="flex-1 p-3 rounded-md border border-[#202024] bg-[#111114] animate-pipeline-node space-y-1"
                  style={{ animationDelay: "660ms" }}
                >
                  <div className="text-[10px] font-mono text-[#6b6b70] uppercase">Risk</div>
                  <div className="text-xs font-mono font-medium text-[#ededed]">{pipeline.risk}</div>
                </div>

                {/* Connector 4 */}
                <div className="hidden sm:flex w-6 h-[1px] bg-[#26262b] items-center justify-center relative overflow-hidden">
                  <div
                    className="w-full h-full bg-[#36363d] animate-line-draw"
                    style={{ animationDelay: "810ms" }}
                  ></div>
                </div>

                {/* Node 5: DECISION */}
                <div
                  className={`flex-1 p-3 rounded-md border animate-decision-node space-y-1 ${
                    pipeline.decision === "BLOCK"
                      ? "border-[#ef4444] bg-[#ef4444]/[0.08] text-[#ef4444]"
                      : pipeline.decision === "ALLOW"
                      ? "border-[#10b981] bg-[#10b981]/[0.08] text-[#10b981]"
                      : "border-dashed border-[#8a8a93] bg-[#111114] text-[#ededed]"
                  }`}
                  style={{ animationDelay: "920ms" }}
                >
                  <div className="text-[10px] font-mono uppercase opacity-75">Decision</div>
                  <div className="text-xs font-mono font-bold tracking-wider">
                    {pipeline.decision}
                  </div>
                </div>
              </div>

              {/* Reasoning Text */}
              <div
                className="p-3.5 rounded-md border border-[#202024] bg-[#111114] text-xs leading-relaxed animate-pipeline-node"
                style={{ animationDelay: "1050ms" }}
              >
                <span className="font-mono text-[#6b6b70] uppercase text-[11px] mr-2">Reason:</span>
                <span className="text-[#ededed]">{pipeline.reason}</span>
              </div>
            </div>
          )}
        </section>

        {/* 4. Pending Approval (Conditional on CONFIRM) */}
        {pendingRequest && (
          <section className="p-4 rounded-md border border-[#26262b] bg-[#111114] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono uppercase text-[#8a8a93] tracking-wider">
                Operator Action Required
              </span>
              <span className="font-mono text-[#6b6b70] text-[11px]">
                {pendingRequest.id}
              </span>
            </div>

            <div className="p-3 rounded border border-[#202024] bg-[#0a0a0c] text-xs font-mono space-y-1 text-[#8a8a93]">
              <div>
                <span className="text-[#55555c]">tool: </span>
                <span className="text-[#ededed]">{pendingRequest.tool_name}</span>
              </div>
              <div>
                <span className="text-[#55555c]">args: </span>
                <span className="text-[#ededed]">{JSON.stringify(pendingRequest.arguments)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => handleApprove(pendingRequest.id)}
                className="h-8 px-4 rounded border border-[#10b981]/50 bg-transparent text-[#10b981] hover:bg-[#10b981] hover:text-black text-xs font-medium transition-all duration-150 cursor-pointer"
              >
                Approve
              </button>
              <button
                onClick={() => handleDeny(pendingRequest.id)}
                className="h-8 px-4 rounded border border-[#303036] bg-transparent text-[#8a8a93] hover:border-[#ef4444] hover:bg-[#ef4444] hover:text-white text-xs font-medium transition-all duration-150 cursor-pointer"
              >
                Deny
              </button>
            </div>
          </section>
        )}

        {/* 5. Stats Row */}
        <section className="grid grid-cols-4 py-4 border-y border-[#202024]">
          <div className="px-4 text-center border-r border-[#202024]">
            <div className="text-2xl font-mono font-medium text-[#ededed]">
              {dashboard.totalRequests}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b6b70] mt-1">
              TOTAL
            </div>
          </div>

          <div className="px-4 text-center border-r border-[#202024]">
            <div className="text-2xl font-mono font-medium text-[#10b981]">
              {dashboard.allowed}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b6b70] mt-1">
              ALLOWED
            </div>
          </div>

          <div className="px-4 text-center border-r border-[#202024]">
            <div className="text-2xl font-mono font-medium text-[#ededed]">
              {dashboard.confirmed}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b6b70] mt-1">
              CONFIRMED
            </div>
          </div>

          <div className="px-4 text-center">
            <div className="text-2xl font-mono font-medium text-[#ef4444]">
              {dashboard.blocked}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b6b70] mt-1">
              BLOCKED
            </div>
          </div>
        </section>

        {/* 6. Recent Events Table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#6b6b70]">
            <span>Recent Events</span>
            <span>Live 2s</span>
          </div>

          {dashboard.recentEvents.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-[#55555c]">
              No events recorded.
            </div>
          ) : (
            <div className="border-t border-[#202024]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#202024] text-[10px] font-mono uppercase tracking-wider text-[#6b6b70]">
                    <th className="py-2.5 pr-4 font-normal">TIME</th>
                    <th className="py-2.5 px-4 font-normal">TOOL</th>
                    <th className="py-2.5 px-4 font-normal">DECISION</th>
                    <th className="py-2.5 pl-4 font-normal">REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1e]">
                  {dashboard.recentEvents.map((evt) => {
                    const isNew = evt.id === newestEventId;
                    const isAllow = evt.event_type === "ALLOW" || evt.event_type === "APPROVED";
                    const isBlock = evt.event_type === "BLOCK" || evt.event_type === "DENIED";

                    return (
                      <tr
                        key={evt.id}
                        className={`transition-colors ${isNew ? "animate-row-highlight" : "hover:bg-white/[0.015]"}`}
                      >
                        <td className="py-3 pr-4 font-mono text-[11px] text-[#6b6b70] whitespace-nowrap">
                          {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#ededed] whitespace-nowrap">
                          {evt.request_id ? "create_database" : "system"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isAllow && (
                            <span className="text-[11px] font-mono text-[#10b981] font-medium">
                              ALLOW
                            </span>
                          )}
                          {isBlock && (
                            <span className="text-[11px] font-mono text-[#ef4444] font-medium">
                              BLOCK
                            </span>
                          )}
                          {!isAllow && !isBlock && (
                            <span className="text-[11px] font-mono text-[#ededed] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full border border-[#8a8a93]"></span>
                              CONFIRM
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 pl-4 text-xs text-[#8a8a93] max-w-sm truncate"
                          title={evt.message}
                        >
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
