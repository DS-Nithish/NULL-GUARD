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
          fetchSecurityEvents(20).catch(() => []),
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
    <div className="min-h-screen bg-[#090a0f] text-slate-200 p-8 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
            <p className="text-sm text-slate-400 mt-1">
              Runtime security inspection and policy enforcement for autonomous agents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Firewall Active
            </span>
          </div>
        </div>

        {/* Minimal Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Blocked */}
          <div className="p-5 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-sm font-medium text-slate-400">Blocked</span>
            <div className="text-3xl font-mono font-semibold text-white mt-2">
              {loading ? "—" : blockedCount}
            </div>
            <p className="text-xs text-rose-400/90 mt-1.5">Threats halted</p>
          </div>

          {/* Card 2: Pending */}
          <Link
            to="/approvals"
            className="p-5 rounded-xl border border-white/[0.08] bg-[#111318] hover:border-amber-500/40 transition-colors block group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400 group-hover:text-amber-300 transition-colors">
                Pending
              </span>
              <span className="text-xs text-slate-500 group-hover:text-amber-400 transition-colors">&rarr;</span>
            </div>
            <div className="text-3xl font-mono font-semibold text-amber-300 mt-2">
              {loading ? "—" : pending.length}
            </div>
            <p className="text-xs text-amber-400/90 mt-1.5">Review queue</p>
          </Link>

          {/* Card 3: Approved */}
          <div className="p-5 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-sm font-medium text-slate-400">Approved</span>
            <div className="text-3xl font-mono font-semibold text-emerald-400 mt-2">
              {loading ? "—" : approvedCount}
            </div>
            <p className="text-xs text-emerald-400/90 mt-1.5">Operator confirmed</p>
          </div>

          {/* Card 4: Safe Allowed */}
          <div className="p-5 rounded-xl border border-white/[0.08] bg-[#111318]">
            <span className="text-sm font-medium text-slate-400">Allowed</span>
            <div className="text-3xl font-mono font-semibold text-slate-200 mt-2">
              {loading ? "—" : allowedCount}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Direct safe execution</p>
          </div>
        </div>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/approvals"
            className="p-6 rounded-xl border border-white/[0.08] bg-[#111318] hover:border-white/[0.2] transition-all block group"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-white group-hover:text-amber-300 transition-colors">
                Approvals Queue
              </h2>
              <span className="text-sm text-slate-500 group-hover:text-white transition-colors">&rarr;</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Review intercepted sensitive actions, inspect argument taint, and authorize or deny tool execution.
            </p>
          </Link>

          <Link
            to="/security-events"
            className="p-6 rounded-xl border border-white/[0.08] bg-[#111318] hover:border-white/[0.2] transition-all block group"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-white group-hover:text-cyan-300 transition-colors">
                Security Events
              </h2>
              <span className="text-sm text-slate-500 group-hover:text-white transition-colors">&rarr;</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Audit log of all firewall decisions with forensic breakdown across provenance, taint, and policy rules.
            </p>
          </Link>

          <Link
            to="/attack-lab"
            className="p-6 rounded-xl border border-white/[0.08] bg-[#111318] hover:border-white/[0.2] transition-all block group"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-white group-hover:text-violet-300 transition-colors">
                Attack Lab
              </h2>
              <span className="text-sm text-slate-500 group-hover:text-white transition-colors">&rarr;</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Run automated malicious and benign test scenarios to verify prompt injection defense and fail-safe behavior.
            </p>
          </Link>
        </div>

        {/* Recent Events Card */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111318] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-sm font-medium text-white">Recent Decisions</span>
            <Link to="/security-events" className="text-xs text-slate-400 hover:text-white transition-colors">
              View all &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No events recorded yet.</div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {events.slice(0, 5).map((evt) => {
                const badgeStyle =
                  evt.event_type === "BLOCK"
                    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                    : evt.event_type === "APPROVED"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : evt.event_type === "CONFIRM"
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    : "text-slate-300 bg-white/[0.06] border-white/[0.1]";

                return (
                  <div key={evt.id} className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${badgeStyle}`}>
                        {evt.event_type}
                      </span>
                      <span className="font-mono text-slate-200 truncate">{evt.tool_name}</span>
                    </div>
                    <div className="text-slate-400 text-xs truncate hidden sm:block max-w-sm">
                      {evt.matched_rule || evt.reasoning}
                    </div>
                    <div className="text-xs font-mono text-slate-500 shrink-0">
                      {evt.created_at ? new Date(evt.created_at).toLocaleTimeString() : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
