import { useState, useEffect, useCallback } from "react";
import { listContainers } from "../api";

interface MountEntry {
  type: string;
  source: string;
  destination: string;
  containers: string[];
}

interface VolumesViewProps {
  refreshInterval: number;
}

export function VolumesView({ refreshInterval }: VolumesViewProps) {
  const [mounts, setMounts] = useState<MountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const containers = await listContainers();
      const mountMap: Map<string, MountEntry> = new Map();

      for (const c of containers) {
        for (const m of c.configuration.mounts ?? []) {
          const type = m.type?.virtiofs != null ? "VirtioFS" : "tmpfs";
          const key = `${type}:${m.source}:${m.destination}`;
          if (!mountMap.has(key)) {
            mountMap.set(key, {
              type,
              source: m.source,
              destination: m.destination,
              containers: [],
            });
          }
          mountMap.get(key)!.containers.push(c.configuration.id);
        }
      }

      setMounts([...mountMap.values()]);
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

  const selectedMount = selected != null ? mounts[selected] : null;

  return (
    <div className="main-content">
      <div className="list-panel">
        <div className="panel-header">
          <span className="panel-title">Volumes & Mounts</span>
          <div className="panel-actions">
            {loading && <span className="spinner" />}
            <button className="btn-icon" onClick={refresh} title="Refresh">
              <RefreshIcon />
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: "8px" }}>{error}</div>}

        <div className="panel-body">
          {mounts.length === 0 && !loading ? (
            <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
              <div className="empty-state-icon">
                <VolumeIcon size={24} />
              </div>
              <p className="empty-state-title">No mounts</p>
              <p className="empty-state-desc">
                Active volume mounts appear here
              </p>
            </div>
          ) : (
            mounts.map((m, i) => (
              <div
                key={i}
                className={`list-item${selected === i ? " selected" : ""}`}
                onClick={() => setSelected(selected === i ? null : i)}
              >
                <div className="list-item-header">
                  <span className="list-item-name" style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: 12 }}>
                    {m.destination}
                  </span>
                  <span className={`badge ${m.type === "VirtioFS" ? "accent" : "neutral"}`}>
                    {m.type}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "SF Mono, Menlo, monospace",
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.source || "—"}
                </div>
                <div className="list-item-meta">
                  <span>{m.containers.length} container{m.containers.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedMount ? (
        <div className="detail-panel">
          <div className="detail-header">
            <div className="detail-icon">
              <VolumeIcon size={20} />
            </div>
            <div className="detail-title-area">
              <div className="detail-name" style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: 14 }}>
                {selectedMount.destination}
              </div>
              <div className="detail-subtitle">{selectedMount.type}</div>
            </div>
            <div className="detail-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)} style={{ padding: "6px 8px" }}>
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="detail-body">
            <div className="section">
              <div className="section-header">
                <span className="section-title">Mount Details</span>
              </div>
              <div className="info-grid">
                <div className="info-cell">
                  <div className="info-cell-label">Type</div>
                  <div className="info-cell-value">{selectedMount.type}</div>
                </div>
                <div className="info-cell">
                  <div className="info-cell-label">Containers</div>
                  <div className="info-cell-value">{selectedMount.containers.length}</div>
                </div>
              </div>
              <div className="info-cell" style={{ marginBottom: 8 }}>
                <div className="info-cell-label">Source (host)</div>
                <div className="info-cell-value mono">{selectedMount.source || "—"}</div>
              </div>
              <div className="info-cell">
                <div className="info-cell-label">Destination (container)</div>
                <div className="info-cell-value mono">{selectedMount.destination}</div>
              </div>
            </div>

            <div className="section">
              <div className="section-header">
                <span className="section-title">Used by</span>
              </div>
              <div className="tag-list">
                {selectedMount.containers.map((cid) => (
                  <span key={cid} className="tag">{cid}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="detail-panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <VolumeIcon size={24} />
            </div>
            <p className="empty-state-title">Select a mount</p>
            <p className="empty-state-desc">
              Click a mount to see details
            </p>
          </div>
        </div>
      )}
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

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function VolumeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
