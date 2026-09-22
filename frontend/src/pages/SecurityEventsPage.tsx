function SecurityEventsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Security Events</h1>
      <p className="text-slate-400">
        Real-time feed of all security events, threat detections, and firewall actions.
      </p>
      <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-slate-500">No security events recorded</p>
        <p className="mt-1 text-sm text-slate-600">Threat detections and firewall actions will stream here.</p>
      </div>
    </div>
  );
}

export default SecurityEventsPage;
