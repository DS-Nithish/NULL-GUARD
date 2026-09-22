import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  fetchPendingApprovals,
  fetchSecurityEvents,
  type SecurityEvent,
  type ToolRequest,
} from "../api";

export default function OverviewPage() {
  const [pending, setPending] = useState<ToolRequest[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [pendingData, eventsData] = await Promise.all([
          fetchPendingApprovals().catch(() => []),
          fetchSecurityEvents(50).catch(() => []),
        ]);
        if (mounted) {
          setPending(pendingData);
          setEvents(eventsData);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const blockedCount = events.filter((e) => e.event_type === "BLOCK").length;
  const approvedCount = events.filter((e) => e.event_type === "APPROVED").length;
  const allowedCount = events.filter((e) => e.event_type === "ALLOW").length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          AgentShield Security Overview
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Runtime AI agent interception firewall — provenance tracking, taint inspection, and policy enforcement.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-rose-400">Threats Blocked</span>
            <span className="text-lg">🛡️</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">
            {loading ? "..." : blockedCount}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Fail-closed prompt injection defenses</span>
        </div>

        <Link
          to="/approvals"
          className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 backdrop-blur-sm hover:border-amber-500/40 transition-colors block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-amber-400">Pending Approvals</span>
            <span className="text-lg">⏳</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-300">
            {loading ? "..." : pending.length}
          </p>
          <span className="text-xs text-amber-500/80 mt-1 block hover:underline">
            View pending queue &rarr;
          </span>
        </Link>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-emerald-400">Approved & Executed</span>
            <span className="text-lg">✅</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-300">
            {loading ? "..." : approvedCount}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Operator human-in-the-loop sign-offs</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">Safe Auto-Allowed</span>
            <span className="text-lg">⚡</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">
            {loading ? "..." : allowedCount}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Verified untainted operations (Rule 5/6)</span>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/approvals"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4" />
                <rect x="3" y="3" width="18" height="18" rx="3" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                Pending Approval Queue
              </h2>
              <p className="text-xs text-slate-400">
                Inspect sensitive tool calls, review forensic reasoning, and authorize or deny tool execution.
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/security-events"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-cyan-500/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Audit Trail & Explainability
              </h2>
              <p className="text-xs text-slate-400">
                Browse tamper-evident security logs and click any decision for full 3-pillar forensic breakdown.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
