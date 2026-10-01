import Link from "next/link";
import type { ReactNode } from "react";

type ActiveSection =
  | "overview"
  | "intake"
  | "explorer"
  | "simulation"
  | "connectors"
  | "demos"
  | "pilot";

type Props = {
  children: ReactNode;
  active: ActiveSection;
  processId?: string;
  processName?: string;
  eyebrow?: string;
  wide?: boolean;
};

type IconName =
  | "overview"
  | "process"
  | "explorer"
  | "simulation"
  | "connector"
  | "history"
  | "demo"
  | "pilot"
  | "settings";

function NavIcon({ name }: { name: IconName }) {
  const icons: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="4" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    process: <><circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="19" cy="18" r="2.2" /><path d="M7.2 11.2 16.8 6.8M7.2 12.8l9.6 4.4" /></>,
    explorer: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5M11 7.5v7M7.5 11h7" /></>,
    simulation: <><path d="M4 18V8m6 10V4m6 14v-7m4 7H2" /><path d="m4 11 6-4 6 5 4-3" /></>,
    connector: <><path d="M8 7V4m8 3V4M6 7h12v4a6 6 0 0 1-12 0V7Z" /><path d="M12 17v4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    demo: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m10 9 5 3-5 3V9Z" /></>,
    pilot: <><path d="M12 3 5 7v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V7l-7-4Z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.2L14.2 3h-4.1l-.3 2.7a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5.3 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.2l.3 2.7h4.1l.3-2.7a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: IconName; label: string; active?: boolean }) {
  return (
    <Link className={active ? "pt-nav-item active" : "pt-nav-item"} href={href}>
      <NavIcon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  active,
  processId,
  processName,
  eyebrow = "Operational intelligence",
  wide = false,
}: Props) {
  const overviewHref = processId ? `/processes/${processId}` : "/processes/new";
  const explorerHref = processId ? `/processes/${processId}/explorer` : "/processes/new";
  const simulationHref = processId ? `/processes/${processId}/simulation` : "/processes/new";
  const connectorsHref = processId ? `/processes/${processId}/connectors` : "/processes/new";
  const syncHref = processId ? `/processes/${processId}/connectors#sync-history` : "/processes/new";

  return (
    <div className="pt-shell">
      <aside className="pt-sidebar" aria-label="Navegação principal">
        <Link className="pt-brand" href="/">
          <span className="pt-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>ProcessTwin</strong><small>AI</small></span>
        </Link>

        {processName && (
          <div className="pt-process-context">
            <span>Processo ativo</span>
            <strong title={processName}>{processName}</strong>
            <small><i /> live workspace</small>
          </div>
        )}

        <nav className="pt-nav">
          <div className="pt-nav-group">
            <span className="pt-nav-label">Workspace</span>
            <NavItem href={overviewHref} icon="overview" label="Overview" active={active === "overview"} />
            <NavItem href="/processes/new" icon="process" label="Universal Intake" active={active === "intake"} />
          </div>
          <div className="pt-nav-group">
            <span className="pt-nav-label">Analyze</span>
            <NavItem href={explorerHref} icon="explorer" label="Process Explorer" active={active === "explorer"} />
            <NavItem href={simulationHref} icon="simulation" label="Simulation Lab" active={active === "simulation"} />
          </div>
          <div className="pt-nav-group">
            <span className="pt-nav-label">Operations</span>
            <NavItem href={connectorsHref} icon="connector" label="Connectors" active={active === "connectors"} />
            <NavItem href={syncHref} icon="history" label="Sync History" />
          </div>
          <div className="pt-nav-group">
            <span className="pt-nav-label">Resources</span>
            <NavItem href="/demo/center" icon="demo" label="Demos" active={active === "demos"} />
            <NavItem href="/pilot" icon="pilot" label="Pilot Guide" active={active === "pilot"} />
          </div>
        </nav>

        <div className="pt-sidebar-footer">
          <div className="pt-nav-item muted" aria-disabled="true">
            <NavIcon name="settings" /><span>Settings</span><small>Soon</small>
          </div>
        </div>
      </aside>

      <section className="pt-stage">
        <header className="pt-topbar">
          <div><span className="pt-topbar-kicker">{eyebrow}</span><strong>{processName ?? "ProcessTwin workspace"}</strong></div>
          <div className="pt-topbar-status"><i /><span>System online</span></div>
        </header>
        <div className={wide ? "pt-main pt-main-wide" : "pt-main"}>{children}</div>
      </section>
    </div>
  );
}
