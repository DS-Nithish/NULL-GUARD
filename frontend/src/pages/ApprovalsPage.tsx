import { useState, useEffect, useCallback } from "react";
import {
  fetchPendingApprovals,
  approveRequest,
  denyRequest,
  type ToolRequest,
} from "../api";

export default function ApprovalsPage() {
  const [pendingRequests, setPendingRequests] = useState<ToolRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [lastActionStatus, setLastActionStatus] = useState<{
    id: string;
    type: "approved" | "denied";
    message: string;
  } | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPendingApprovals();
      setPendingRequests(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
    const interval = setInterval(() => {
      loadPending();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadPending]);

  const handleApprove = async (requestId: string) => {
    try {
      setActionInProgress(requestId);
      await approveRequest(requestId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      setLastActionStatus({
        id: requestId,
        type: "approved",
        message: `Request ${requestId} approved and executed via Tool Gateway.`,
      });
      loadPending();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Approval error: ${msg}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      setActionInProgress(requestId);
      await denyRequest(requestId, "Operator manually rejected tool invocation.");
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      setLastActionStatus({
        id: requestId,
        type: "denied",
        message: `Request ${requestId} denied. Action blocked from gateway.`,
      });
      loadPending();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Denial error: ${msg}`);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Human Approval Queue
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingRequests.length} Pending
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Intercepted tool requests awaiting human verification before Gateway execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadPending()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Live polling (3s)
          </span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {lastActionStatus && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            lastActionStatus.type === "approved"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {lastActionStatus.type === "approved" ? "✅" : "🛑"}
            </span>
            <span className="text-sm font-medium">{lastActionStatus.message}</span>
          </div>
          <button
            onClick={() => setLastActionStatus(null)}
            className="text-xs opacity-75 hover:opacity-100 underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 text-sm">
          <strong>Notice:</strong> {error}. Ensure backend is running on port 4000.
        </div>
      )}

      {/* Content Area */}
      <div>
        {loading && pendingRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 rounded-xl border border-white/5 bg-white/[0.01]">
            <div className="inline-block w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Checking approval queue...</p>
          </div>
        ) : pendingRequests.length === 0 ? (
          /* Empty State */
          <div className="p-14 text-center rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-emerald-400"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">No Pending Approvals</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              All intercepted tool calls are resolved. When an agent triggers a sensitive action requiring verification (e.g. Rule 4), it will appear here in real time.
            </p>
          </div>
        ) : (
          /* Pending Requests Cards */
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 transition-all hover:border-amber-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Left Column: Tool details & arguments */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/10 text-white font-semibold border border-white/15">
                        {req.tool_id}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          req.risk_level === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : req.risk_level === "HIGH"
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {req.risk_level} Risk
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {req.id}
                      </span>
                    </div>

                    {/* Firewall Reasoning */}
                    <div className="text-sm rounded-lg bg-black/40 border border-white/5 p-3">
                      <span className="text-xs text-amber-400 font-semibold block mb-1">
                        FIREWALL REASONING (POLICY ENGINE)
                      </span>
                      <p className="text-slate-300 font-sans">
                        {req.reason || "High-risk action requiring operator sign-off before gateway release."}
                      </p>
                    </div>

                    {/* Tool Arguments */}
                    <div>
                      <span className="text-xs text-slate-400 font-medium block mb-1">
                        INVOCATION ARGUMENTS:
                      </span>
                      <pre className="text-xs font-mono bg-black/60 border border-white/10 rounded-lg p-3 text-slate-200 overflow-x-auto max-h-48">
                        {JSON.stringify(req.arguments, null, 2)}
                      </pre>
                    </div>

                    <div className="text-xs text-slate-500">
                      Requested at: {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-row lg:flex-col gap-3 min-w-[150px] self-end lg:self-center">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionInProgress === req.id}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionInProgress === req.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      Approve
                    </button>

                    <button
                      onClick={() => handleDeny(req.id)}
                      disabled={actionInProgress === req.id}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
