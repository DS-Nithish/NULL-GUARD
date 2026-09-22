function AttackLabPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Attack Lab</h1>
      <p className="text-slate-400">
        Simulate indirect prompt injection attacks to test your firewall policies.
      </p>
      <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-slate-500">Attack Lab — coming soon</p>
        <p className="mt-1 text-sm text-slate-600">Run controlled injection scenarios against your agents.</p>
      </div>
    </div>
  );
}

export default AttackLabPage;
