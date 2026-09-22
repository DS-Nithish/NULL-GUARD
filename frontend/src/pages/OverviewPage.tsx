function OverviewPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Overview</h1>
      <p className="text-slate-400">
        System-wide dashboard — threat metrics, agent activity, and security posture at a glance.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          { label: "Threats Blocked", value: "—", color: "var(--color-shield-500)" },
          { label: "Active Agents", value: "—", color: "#22c55e" },
          { label: "Pending Approvals", value: "—", color: "#f59e0b" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-colors hover:border-white/10"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-4xl font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OverviewPage;
