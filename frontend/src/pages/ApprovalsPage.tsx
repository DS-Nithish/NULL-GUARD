function ApprovalsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Approvals</h1>
      <p className="text-slate-400">
        Review and approve or deny flagged tool calls from AI agents.
      </p>
      <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="3" width="18" height="18" rx="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-slate-500">No pending approvals</p>
        <p className="mt-1 text-sm text-slate-600">Flagged tool calls will appear here for review.</p>
      </div>
    </div>
  );
}

export default ApprovalsPage;
