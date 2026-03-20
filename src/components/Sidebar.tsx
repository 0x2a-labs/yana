import type { View } from "../App";

interface SidebarProps {
  current: View;
  onNavigate: (v: View) => void;
  containerCount: number;
  runningCount: number;
  imageCount: number;
  cliVersion: string;
}

export function Sidebar({
  current,
  onNavigate,
  containerCount,
  runningCount,
  imageCount,
  cliVersion,
}: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Yana</div>
        <div className="sidebar-subtitle">container manager</div>
      </div>

      <div className="sidebar-nav">
        <NavItem
          id="containers"
          label="Containers"
          current={current}
          onNavigate={onNavigate}
          badge={containerCount > 0 ? containerCount : undefined}
          icon={<ContainersIcon />}
        />
        <NavItem
          id="images"
          label="Images"
          current={current}
          onNavigate={onNavigate}
          badge={imageCount > 0 ? imageCount : undefined}
          badgeMuted
          icon={<ImagesIcon />}
        />
        <NavItem
          id="networks"
          label="Networks"
          current={current}
          onNavigate={onNavigate}
          icon={<NetworksIcon />}
        />
        <NavItem
          id="volumes"
          label="Volumes"
          current={current}
          onNavigate={onNavigate}
          icon={<VolumesIcon />}
        />
        <NavItem
          id="dns"
          label="DNS"
          current={current}
          onNavigate={onNavigate}
          icon={<DnsIcon />}
        />

        <div className="sidebar-section-label">System</div>

        <NavItem
          id="system"
          label="System"
          current={current}
          onNavigate={onNavigate}
          icon={<SystemIcon />}
        />
        <NavItem
          id="settings"
          label="Settings"
          current={current}
          onNavigate={onNavigate}
          icon={<SettingsIcon />}
        />
      </div>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span
            className={`status-dot ${runningCount > 0 ? "running" : "stopped"}`}
          />
          <span>
            {runningCount > 0
              ? `${runningCount} running`
              : "no containers"}
          </span>
          {cliVersion && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "var(--text-caption)",
                fontFamily: "SF Mono, Menlo, monospace",
              }}
            >
              {cliVersion.replace("container CLI version ", "v").split(" ")[0]}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

interface NavItemProps {
  id: View;
  label: string;
  current: View;
  onNavigate: (v: View) => void;
  icon: React.ReactNode;
  badge?: number;
  badgeMuted?: boolean;
}

function NavItem({ id, label, current, onNavigate, icon, badge, badgeMuted }: NavItemProps) {
  return (
    <div
      className={`nav-item${current === id ? " active" : ""}`}
      onClick={() => onNavigate(id)}
    >
      {icon}
      {label}
      {badge != null && (
        <span className={`nav-badge${badgeMuted ? " muted" : ""}`}>{badge}</span>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ContainersIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function ImagesIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <circle cx="7" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NetworksIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9" />
    </svg>
  );
}

function VolumesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function DnsIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth={2} />
      <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth={2} />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
