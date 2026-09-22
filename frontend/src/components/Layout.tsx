import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview", icon: OverviewIcon },
  { to: "/approvals", label: "Approvals", icon: ApprovalsIcon },
  { to: "/attack-lab", label: "Attack Lab", icon: AttackLabIcon },
  { to: "/security-events", label: "Security Events", icon: SecurityEventsIcon },
];

function Layout() {
  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-white/5 bg-[var(--color-surface-elevated)]">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, var(--color-shield-600), var(--color-shield-800))",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            Agent<span className="text-[var(--color-shield-400)]">Shield</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--color-shield-600)]/15 text-[var(--color-shield-400)]"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 px-5 py-4">
          <p className="text-xs text-slate-600">AgentShield · Prototype</p>
        </div>
      </aside>

      {/* Main content area */}
      <main className="ml-64 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

/* ── Inline SVG icon components ── */

function OverviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ApprovalsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 12l2 2 4-4" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function AttackLabIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function SecurityEventsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default Layout;
