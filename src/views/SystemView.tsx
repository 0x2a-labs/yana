import { useState, useEffect, useCallback } from "react";
import type { SystemDf, SystemProperty } from "../types";
import {
  systemDf,
  listSystemProperties,
  setSystemProperty,
  systemStart,
  systemStop,
  systemRestart,
  getVersion,
  formatBytes,
} from "../api";

interface SystemViewProps {
  refreshInterval: number;
}

export function SystemView({ refreshInterval }: SystemViewProps) {
  const [df, setDf] = useState<SystemDf | null>(null);
  const [properties, setProperties] = useState<SystemProperty[]>([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dfData, propsData, ver] = await Promise.all([
        systemDf(),
        listSystemProperties(),
        getVersion().catch(() => ""),
      ]);
      setDf(dfData);
      setProperties(propsData);
      setVersion(ver.trim());
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

  async function doSystemAction(fn: () => Promise<string>) {
    setActionLoading(true);
    setActionError(null);
    try {
      await fn();
      setTimeout(refresh, 1000);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setActionLoading(false);
    }
  }

  const totalBytes = df
    ? df.containers.sizeInBytes + df.images.sizeInBytes + df.volumes.sizeInBytes
    : 0;
  const reclaimableBytes = df
    ? df.containers.reclaimable + df.images.reclaimable + df.volumes.reclaimable
    : 0;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-icon">
          <SystemIcon size={20} />
        </div>
        <div className="detail-title-area">
          <div className="detail-name">System</div>
          <div className="detail-subtitle">{version || "container CLI"}</div>
        </div>
        <div className="detail-actions">
          {loading && <span className="spinner" />}
          <button className="btn-icon" onClick={refresh} title="Refresh">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="detail-body">
        {error && <div className="error-banner">{error}</div>}
        {actionError && <div className="error-banner">{actionError}</div>}

        {/* System controls */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Controls</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-success"
              onClick={() => doSystemAction(systemStart)}
              disabled={actionLoading}
            >
              <PlayIcon /> Start
            </button>
            <button
              className="btn-danger"
              onClick={() => doSystemAction(systemStop)}
              disabled={actionLoading}
            >
              <StopIcon /> Stop
            </button>
            <button
              className="btn-secondary"
              onClick={() => doSystemAction(systemRestart)}
              disabled={actionLoading}
            >
              <RestartIcon /> Restart
            </button>
          </div>
        </div>

        <div className="divider" />

        {/* Disk usage */}
        {df && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Disk usage</span>
              <span className="badge neutral">
                {formatBytes(reclaimableBytes)} reclaimable
              </span>
            </div>

            <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              <div className="metric-card">
                <div className="metric-label">Containers</div>
                <div className="metric-value" style={{ fontSize: 20 }}>
                  {formatBytes(df.containers.sizeInBytes)}
                </div>
                <div className="metric-sub">
                  {df.containers.active}/{df.containers.total} active
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Images</div>
                <div className="metric-value" style={{ fontSize: 20 }}>
                  {formatBytes(df.images.sizeInBytes)}
                </div>
                <div className="metric-sub">
                  {df.images.active}/{df.images.total} active
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Volumes</div>
                <div className="metric-value" style={{ fontSize: 20 }}>
                  {formatBytes(df.volumes.sizeInBytes)}
                </div>
                <div className="metric-sub">
                  {df.volumes.active}/{df.volumes.total} active
                </div>
              </div>
            </div>

            {/* Disk usage bars */}
            {totalBytes > 0 && (
              <div style={{ marginTop: 8 }}>
                <DiskBar
                  label="Containers"
                  bytes={df.containers.sizeInBytes}
                  total={totalBytes}
                  color="var(--accent)"
                />
                <DiskBar
                  label="Images"
                  bytes={df.images.sizeInBytes}
                  total={totalBytes}
                  color="var(--purple)"
                />
                {df.volumes.sizeInBytes > 0 && (
                  <DiskBar
                    label="Volumes"
                    bytes={df.volumes.sizeInBytes}
                    total={totalBytes}
                    color="var(--teal)"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="divider" />

        {/* Properties */}
        {properties.length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">System properties</span>
            </div>
            {properties.map((prop) => (
              <PropertyRow key={prop.id} property={prop} onSet={async (val) => {
                await setSystemProperty(prop.id, val);
                refresh();
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiskBar({
  label,
  bytes,
  total,
  color,
}: {
  label: string;
  bytes: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (bytes / total) * 100 : 0;
  return (
    <div className="resource-row">
      <div className="resource-label-row">
        <span className="resource-label">{label}</span>
        <span className="resource-value">{formatBytes(bytes)}</span>
      </div>
      <div className="resource-bar-track">
        <div
          className="resource-bar-fill"
          style={{ width: `${pct.toFixed(1)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function PropertyRow({
  property: prop,
  onSet,
}: {
  property: SystemProperty;
  onSet: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(prop.value ?? ""));
  const [saving, setSaving] = useState(false);

  const displayValue =
    prop.value === null || prop.value === undefined
      ? <span style={{ color: "var(--text-caption)" }}>undefined</span>
      : String(prop.value);

  async function save() {
    setSaving(true);
    try {
      await onSet(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="toggle-row">
      <div className="toggle-info">
        <div className="toggle-name">{prop.id}</div>
        <div className="toggle-desc">{prop.description}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
        {editing ? (
          <>
            {prop.type === "Bool" ? (
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{ width: 80, padding: "4px 8px", fontSize: 12 }}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{ width: 180, padding: "4px 8px", fontSize: 12 }}
                autoFocus
              />
            )}
            <button
              className="btn-primary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={save}
              disabled={saving}
            >
              Save
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => { setEditing(false); setValue(String(prop.value ?? "")); }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span
              style={{
                fontFamily: "SF Mono, Menlo, monospace",
                fontSize: 12,
                color: "var(--text-secondary)",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayValue}
            </span>
            <button
              className="btn-secondary"
              style={{ padding: "3px 10px", fontSize: 11 }}
              onClick={() => { setEditing(true); setValue(String(prop.value ?? "")); }}
            >
              Edit
            </button>
          </>
        )}
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

function PlayIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function SystemIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
