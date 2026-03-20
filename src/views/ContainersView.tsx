import { useState, useEffect, useCallback } from "react";
import type { Container, ContainerStats, RunContainerOptions } from "../types";
import {
  listContainers,
  getContainerStats,
  getContainerLogs,
  startContainer,
  stopContainer,
  removeContainer,
  runContainer,
  openShell,
  formatBytes,
  memoryPercent,
} from "../api";

interface ContainersViewProps {
  refreshInterval: number;
}

export function ContainersView({ refreshInterval }: ContainersViewProps) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [stats, setStats] = useState<Record<string, ContainerStats>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);

  // Fast path: just container ls
  const refresh = useCallback(async () => {
    try {
      const cs = await listContainers();
      setContainers(cs);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Background stats cache — runs independently, never blocks the list
  const refreshStats = useCallback(async () => {
    try {
      const st = await getContainerStats();
      const statsMap: Record<string, ContainerStats> = {};
      for (const s of st) statsMap[s.id] = s;
      setStats(statsMap);
    } catch {
      // stats are optional; silently ignore errors
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  useEffect(() => {
    // Delay first stats fetch slightly so the list renders first
    const initial = setTimeout(refreshStats, 500);
    const id = setInterval(refreshStats, Math.max(refreshInterval, 5) * 1000);
    return () => { clearTimeout(initial); clearInterval(id); };
  }, [refreshStats, refreshInterval]);

  const selectedContainer = containers.find(
    (c) => c.configuration.id === selected
  );

  return (
    <div className="main-content" style={{ position: "relative" }}>
      {/* List panel */}
      <div className="list-panel">
        <div className="panel-header">
          <span className="panel-title">Containers</span>
          <div className="panel-actions">
            {loading && <span className="spinner" />}
            <button className="btn-icon" onClick={refresh} title="Refresh">
              <RefreshIcon />
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowRunModal(true)}
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              <PlusIcon /> Run
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: "8px" }}>{error}</div>}

        <div className="panel-body">
          {containers.length === 0 && !loading ? (
            <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
              <div className="empty-state-icon">
                <ContainerCubeIcon size={24} />
              </div>
              <p className="empty-state-title">No containers</p>
              <p className="empty-state-desc">
                Run a container to get started
              </p>
            </div>
          ) : (
            containers.map((c) => (
              <ContainerListItem
                key={c.configuration.id}
                container={c}
                stat={stats[c.configuration.id]}
                selected={selected === c.configuration.id}
                onClick={() =>
                  setSelected(
                    selected === c.configuration.id ? null : c.configuration.id
                  )
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedContainer ? (
        <ContainerDetail
          container={selectedContainer}
          stat={stats[selectedContainer.configuration.id]}
          onClose={() => setSelected(null)}
          onRefresh={refresh}
        />
      ) : (
        <div className="detail-panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <ContainerCubeIcon size={24} />
            </div>
            <p className="empty-state-title">Select a container</p>
            <p className="empty-state-desc">
              Click a container in the list to view details
            </p>
          </div>
        </div>
      )}

      {showRunModal && (
        <RunContainerModal
          onClose={() => setShowRunModal(false)}
          onRun={async (opts) => {
            await runContainer(opts);
            setShowRunModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Container list item ──────────────────────────────────────────────────────

function ContainerListItem({
  container: c,
  stat,
  selected,
  onClick,
}: {
  container: Container;
  stat?: ContainerStats;
  selected: boolean;
  onClick: () => void;
}) {
  const id = c.configuration.id;
  const ip = c.networks?.[0]?.ipv4Address?.split("/")?.[0] ?? "—";
  const memPct = stat
    ? memoryPercent(stat.memoryUsageBytes, stat.memoryLimitBytes)
    : 0;

  return (
    <div className={`list-item${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="list-item-header">
        <span className="list-item-name">{id}</span>
        <StatusBadge status={c.status} />
      </div>
      <div
        className="list-item-image"
        style={{ marginBottom: 6 }}
      >
        {c.configuration.image.reference}
      </div>
      <div className="list-item-meta">
        <span style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: 11 }}>
          {ip}
        </span>
        <span style={{ color: "var(--text-caption)" }}>·</span>
        <span>{c.configuration.platform?.architecture ?? "arm64"}</span>
        {stat && (
          <>
            <span style={{ color: "var(--text-caption)" }}>·</span>
            <span style={{ color: memPct > 80 ? "var(--red)" : "var(--text-muted)" }}>
              {formatBytes(stat.memoryUsageBytes)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Container detail ─────────────────────────────────────────────────────────

type DetailTab = "info" | "logs" | "env" | "mounts";

function ContainerDetail({
  container: c,
  stat,
  onClose,
  onRefresh,
}: {
  container: Container;
  stat?: ContainerStats;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("info");
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [bootLogs, setBootLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const id = c.configuration.id;
  const ip = c.networks?.[0]?.ipv4Address?.split("/")?.[0] ?? "—";
  const memPct = stat
    ? memoryPercent(stat.memoryUsageBytes, stat.memoryLimitBytes)
    : 0;
  const isRunning = c.status === "running";

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const l = await getContainerLogs(id, bootLogs);
      setLogs(l);
    } catch (e) {
      setLogs(`Error: ${String(e)}`);
    } finally {
      setLoadingLogs(false);
    }
  }, [id, bootLogs]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  async function doAction(fn: () => Promise<unknown>) {
    setActionLoading(true);
    setActionError(null);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-icon">
          <ContainerCubeIcon size={20} />
        </div>
        <div className="detail-title-area">
          <div className="detail-name">{id}</div>
          <div className="detail-subtitle">
            {c.configuration.image.reference}
          </div>
        </div>
        <div className="detail-actions">
          <StatusBadge status={c.status} />
          {isRunning ? (
            <button
              className="btn-danger"
              onClick={() => doAction(() => stopContainer(id))}
              disabled={actionLoading}
            >
              Stop
            </button>
          ) : (
            <button
              className="btn-success"
              onClick={() => doAction(() => startContainer(id))}
              disabled={actionLoading}
            >
              Start
            </button>
          )}
          {isRunning && (
            <button
              className="btn-secondary"
              onClick={() => openShell(id).catch((e) => setActionError(String(e)))}
              title="Open interactive shell in Terminal.app"
            >
              <TerminalIcon /> Shell
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => doAction(async () => { await removeContainer(id); onClose(); })}
            disabled={actionLoading || isRunning}
            title={isRunning ? "Stop first" : "Remove"}
          >
            Remove
          </button>
          <button className="btn-ghost" onClick={onClose} style={{ padding: "6px 8px" }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="error-banner" style={{ margin: "0 20px 0", borderRadius: "0 0 8px 8px" }}>
          {actionError}
        </div>
      )}

      <div className="tabs">
        {(["info", "logs", "env", "mounts"] as DetailTab[]).map((t) => (
          <button
            key={t}
            className={`tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === "info" && (
          <InfoTab container={c} stat={stat} ip={ip} memPct={memPct} />
        )}
        {tab === "logs" && (
          <LogsTab
            logs={logs}
            loading={loadingLogs}
            bootLogs={bootLogs}
            onToggleBoot={(v) => { setBootLogs(v); }}
            onRefresh={fetchLogs}
          />
        )}
        {tab === "env" && <EnvTab env={c.configuration.initProcess?.environment ?? []} />}
        {tab === "mounts" && <MountsTab mounts={c.configuration.mounts} />}
      </div>
    </div>
  );
}

function InfoTab({
  container: c,
  stat,
  ip,
  memPct,
}: {
  container: Container;
  stat?: ContainerStats;
  ip: string;
  memPct: number;
}) {
  const memClass = memPct > 80 ? "danger" : memPct > 60 ? "warn" : "";

  return (
    <>
      {/* Stats */}
      {stat && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Resources</span>
            <span className="badge neutral">{stat.numProcesses} proc{stat.numProcesses !== 1 ? "s" : ""}</span>
          </div>
          <div className="resource-row">
            <div className="resource-label-row">
              <span className="resource-label">Memory</span>
              <span className="resource-value">
                {formatBytes(stat.memoryUsageBytes)} / {formatBytes(stat.memoryLimitBytes)}
              </span>
            </div>
            <div className="resource-bar-track">
              <div
                className={`resource-bar-fill memory ${memClass}`}
                style={{ width: `${memPct.toFixed(1)}%` }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <div className="info-cell">
              <div className="info-cell-label">Net In</div>
              <div className="info-cell-value mono">{formatBytes(stat.networkRxBytes)}</div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Net Out</div>
              <div className="info-cell-value mono">{formatBytes(stat.networkTxBytes)}</div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Disk Read</div>
              <div className="info-cell-value mono">{formatBytes(stat.blockReadBytes)}</div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Disk Write</div>
              <div className="info-cell-value mono">{formatBytes(stat.blockWriteBytes)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Network */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Network</span>
        </div>
        <div className="info-grid cols3">
          <div className="info-cell">
            <div className="info-cell-label">IP Address</div>
            <div className="info-cell-value mono">{ip}</div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">Network</div>
            <div className="info-cell-value">{c.networks?.[0]?.network ?? "—"}</div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">Hostname</div>
            <div className="info-cell-value mono" style={{ fontSize: 11 }}>
              {c.networks?.[0]?.hostname ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Configuration</span>
        </div>
        <div className="info-grid">
          <div className="info-cell">
            <div className="info-cell-label">Architecture</div>
            <div className="info-cell-value">
              {c.configuration.platform?.architecture}
              {c.configuration.rosetta && (
                <span className="badge accent" style={{ marginLeft: 6, fontSize: 10 }}>Rosetta</span>
              )}
            </div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">CPUs</div>
            <div className="info-cell-value">{c.configuration.resources?.cpus ?? "—"}</div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">Memory</div>
            <div className="info-cell-value mono">
              {c.configuration.resources?.memoryInBytes
                ? formatBytes(c.configuration.resources.memoryInBytes)
                : "—"}
            </div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">Runtime</div>
            <div className="info-cell-value" style={{ fontSize: 11 }}>
              {c.configuration.runtimeHandler?.replace("container-runtime-", "") ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Process */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Process</span>
        </div>
        <div className="info-cell" style={{ marginBottom: 8 }}>
          <div className="info-cell-label">Executable</div>
          <div className="info-cell-value mono">
            {[
              c.configuration.initProcess?.executable,
              ...(c.configuration.initProcess?.arguments ?? []),
            ].join(" ")}
          </div>
        </div>
        <div className="info-grid">
          <div className="info-cell">
            <div className="info-cell-label">Working Dir</div>
            <div className="info-cell-value mono">
              {c.configuration.initProcess?.workingDirectory ?? "/"}
            </div>
          </div>
          <div className="info-cell">
            <div className="info-cell-label">User</div>
            <div className="info-cell-value mono">
              {c.configuration.initProcess?.user?.id
                ? `${c.configuration.initProcess.user.id.uid}:${c.configuration.initProcess.user.id.gid}`
                : "root"}
            </div>
          </div>
        </div>
      </div>

      {/* Image digest */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Image</span>
        </div>
        <div className="info-cell">
          <div className="info-cell-label">Digest</div>
          <div className="info-cell-value mono" style={{ fontSize: 10, wordBreak: "break-all" }}>
            {c.configuration.image.descriptor?.digest ?? "—"}
          </div>
        </div>
      </div>
    </>
  );
}

function LogsTab({
  logs,
  loading,
  bootLogs,
  onToggleBoot,
  onRefresh,
}: {
  logs: string;
  loading: boolean;
  bootLogs: boolean;
  onToggleBoot: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const colorLine = (line: string) => {
    if (/error|fail|err/i.test(line)) return "err";
    if (/warn/i.test(line)) return "warn";
    if (/200|201|success|ok/i.test(line)) return "ok";
    return "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <button
          className={`btn-secondary${bootLogs ? "" : ""}`}
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={() => onToggleBoot(!bootLogs)}
        >
          {bootLogs ? "App Logs" : "Boot Logs"}
        </button>
        <button
          className="btn-icon"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh logs"
        >
          <RefreshIcon />
        </button>
        {loading && <span className="spinner" />}
      </div>
      <div className="log-viewer" style={{ flex: 1, minHeight: 300 }}>
        {logs.split("\n").map((line, i) => (
          <span key={i} className={`log-line ${colorLine(line)}`}>
            {line + "\n"}
          </span>
        ))}
      </div>
    </div>
  );
}

function EnvTab({ env }: { env: string[] }) {
  if (env.length === 0) {
    return (
      <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
        <p className="empty-state-desc">No environment variables</p>
      </div>
    );
  }
  return (
    <div>
      {env.map((e, i) => {
        const [key, ...rest] = e.split("=");
        const val = rest.join("=");
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              padding: "8px 0",
              borderBottom: "0.5px solid var(--border-subtle)",
              fontSize: 12,
              fontFamily: "SF Mono, Menlo, monospace",
            }}
          >
            <span style={{ color: "var(--teal)", minWidth: 150, fontWeight: 500 }}>
              {key}
            </span>
            <span style={{ color: "var(--text-secondary)", wordBreak: "break-all" }}>
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MountsTab({ mounts }: { mounts: Container["configuration"]["mounts"] }) {
  if (!mounts || mounts.length === 0) {
    return (
      <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
        <p className="empty-state-desc">No volume mounts</p>
      </div>
    );
  }
  return (
    <div>
      {mounts.map((m, i) => {
        const type = m.type.virtiofs != null ? "VirtioFS" : "tmpfs";
        return (
          <div key={i} className="info-cell" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span className="badge neutral">{type}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>
              <span style={{ color: "var(--text-caption)" }}>host: </span>
              <span className="mono">{m.source || "—"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-caption)" }}>container: </span>
              <span className="mono">{m.destination}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Run Container Modal ──────────────────────────────────────────────────────

function RunContainerModal({
  onClose,
  onRun,
}: {
  onClose: () => void;
  onRun: (opts: RunContainerOptions) => Promise<void>;
}) {
  const [image, setImage] = useState("");
  const [name, setName] = useState("");
  const [detach, setDetach] = useState(true);
  const [remove, setRemove] = useState(false);
  const [ports, setPorts] = useState("");
  const [volumes, setVolumes] = useState("");
  const [envs, setEnvs] = useState("");
  const [command, setCommand] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!image.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onRun({
        image: image.trim(),
        name: name.trim() || undefined,
        detach,
        remove_on_stop: remove,
        ports: ports.split("\n").map(s => s.trim()).filter(Boolean),
        volumes: volumes.split("\n").map(s => s.trim()).filter(Boolean),
        env_vars: envs.split("\n").map(s => s.trim()).filter(Boolean),
        command: command.trim() || undefined,
        cpus: cpus.trim() || undefined,
        memory: memory.trim() || undefined,
      });
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Run Container</span>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <CloseIcon />
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="form-group">
          <label className="form-label">Image *</label>
          <input
            type="text"
            placeholder="e.g. ubuntu:latest"
            value={image}
            onChange={e => setImage(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label">Name (optional)</label>
          <input type="text" placeholder="my-container" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="form-group">
            <label className="form-label">CPUs</label>
            <input type="text" placeholder="4" value={cpus} onChange={e => setCpus(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Memory</label>
            <input type="text" placeholder="1g" value={memory} onChange={e => setMemory(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ports (one per line, host:container)</label>
          <textarea rows={2} placeholder="8080:80" value={ports} onChange={e => setPorts(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Volumes (one per line, host:container)</label>
          <textarea rows={2} placeholder="/host/path:/container/path" value={volumes} onChange={e => setVolumes(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Environment variables (one per line, KEY=VALUE)</label>
          <textarea rows={2} placeholder="MY_VAR=value" value={envs} onChange={e => setEnvs(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Command override</label>
          <input type="text" placeholder='sh -c "echo hello"' value={command} onChange={e => setCommand(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={detach} onChange={e => setDetach(e.target.checked)} />
            Detach (-d)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={remove} onChange={e => setRemove(e.target.checked)} />
            Remove on stop (--rm)
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!image.trim() || loading}>
            {loading ? <><span className="spinner" />Starting…</> : "Run"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span className="badge-dot" />
      {status}
    </span>
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

function PlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

function TerminalIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function ContainerCubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
