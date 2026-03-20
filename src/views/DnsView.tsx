import { useState, useEffect, useCallback } from "react";
import { listDns } from "../api";

interface DnsViewProps {
  refreshInterval: number;
}

export function DnsView({ refreshInterval }: DnsViewProps) {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await listDns();
      setDomains(d);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  return (
    <div className="main-content">
      <div className="list-panel" style={{ width: "100%", borderRight: "none" }}>
        <div className="panel-header">
          <span className="panel-title">DNS Domains</span>
          <div className="panel-actions">
            {loading && <span className="spinner" />}
            <button className="btn-icon" onClick={refresh} title="Refresh">
              <RefreshIcon />
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: "8px" }}>{error}</div>}

        <div className="panel-body">
          <div
            className="error-banner"
            style={{
              background: "rgba(255,159,10,0.08)",
              borderColor: "rgba(255,159,10,0.3)",
              color: "var(--yellow)",
              marginBottom: 16,
            }}
          >
            Creating and deleting DNS domains requires elevated privileges (sudo).
            Use the terminal: <code style={{ fontFamily: "SF Mono, Menlo, monospace" }}>sudo container system dns create &lt;domain&gt;</code>
          </div>

          {domains.length === 0 && !loading ? (
            <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
              <div className="empty-state-icon">
                <DnsIcon size={24} />
              </div>
              <p className="empty-state-title">No DNS domains</p>
              <p className="empty-state-desc">
                DNS domains map container names to IP addresses
              </p>
            </div>
          ) : (
            <div>
              {domains.map((domain) => (
                <div
                  key={domain}
                  className="list-item"
                  style={{ cursor: "default" }}
                >
                  <div className="list-item-header">
                    <span className="list-item-name" style={{ fontFamily: "SF Mono, Menlo, monospace" }}>
                      {domain}
                    </span>
                    <span className="badge accent">active</span>
                  </div>
                  <div className="list-item-meta">
                    <span>DNS search domain</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel">
        <div className="detail-body" style={{ paddingTop: 24 }}>
          <div className="section">
            <div className="section-header">
              <span className="section-title">About DNS domains</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
              DNS domains let containers resolve each other by hostname. When you
              set a DNS domain (e.g. <code className="tag" style={{ display: "inline" }}>test</code>), containers
              can be reached at <code className="tag" style={{ display: "inline" }}>container-name.test</code>.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
              The default domain is configured via system properties. You can add
              additional domains for multi-tenant or isolated environments.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Managing DNS domains requires administrator privileges because it
              modifies system-level DNS configuration.
            </p>
          </div>

          <div className="section">
            <div className="section-header">
              <span className="section-title">Common commands</span>
            </div>
            <div className="log-viewer" style={{ minHeight: "auto", height: "auto", padding: "14px 16px" }}>
              {[
                "# List DNS domains",
                "container system dns ls",
                "",
                "# Create a DNS domain",
                "sudo container system dns create my.domain",
                "",
                "# Delete a DNS domain",
                "sudo container system dns delete my.domain",
                "",
                "# Create domain for host access",
                "sudo container system dns create host.container.internal \\",
                "  --localhost 203.0.113.1",
              ].map((line, i) => (
                <span
                  key={i}
                  className={`log-line${line.startsWith("#") ? " ok" : ""}`}
                  style={{ color: line.startsWith("#") ? "var(--text-caption)" : "" }}
                >
                  {line + "\n"}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function DnsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth={2} />
      <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth={2} />
    </svg>
  );
}
