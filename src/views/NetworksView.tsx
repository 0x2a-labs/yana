import { useState, useEffect, useCallback } from "react";
import type { Network } from "../types";
import { listNetworks, createNetwork, deleteNetwork } from "../api";

interface NetworksViewProps {
  refreshInterval: number;
}

export function NetworksView({ refreshInterval }: NetworksViewProps) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const nets = await listNetworks();
      setNetworks(nets);
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

  async function doDelete(id: string) {
    try {
      await deleteNetwork(id);
      if (selected === id) setSelected(null);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  const selectedNetwork = networks.find((n) => n.id === selected);

  return (
    <div className="main-content">
      <div className="list-panel">
        <div className="panel-header">
          <span className="panel-title">Networks</span>
          <div className="panel-actions">
            {loading && <span className="spinner" />}
            <button className="btn-icon" onClick={refresh} title="Refresh">
              <RefreshIcon />
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowCreate(true)}
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              <PlusIcon /> Create
            </button>
          </div>
        </div>

        {error && <div className="error-banner" style={{ margin: "8px" }}>{error}</div>}

        <div className="panel-body">
          {networks.length === 0 && !loading ? (
            <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
              <div className="empty-state-icon">
                <NetworkIcon size={24} />
              </div>
              <p className="empty-state-title">No networks</p>
            </div>
          ) : (
            networks.map((net) => (
              <div
                key={net.id}
                className={`list-item${selected === net.id ? " selected" : ""}`}
                onClick={() => setSelected(selected === net.id ? null : net.id)}
              >
                <div className="list-item-header">
                  <span className="list-item-name">{net.id}</span>
                  <span className={`badge ${net.state === "running" ? "running" : "stopped"}`}>
                    <span className="badge-dot" />
                    {net.state}
                  </span>
                </div>
                <div className="list-item-meta">
                  {net.status?.ipv4Subnet && (
                    <span style={{ fontFamily: "SF Mono, Menlo, monospace", fontSize: 11 }}>
                      {net.status.ipv4Subnet}
                    </span>
                  )}
                  {net.status?.ipv4Gateway && (
                    <>
                      <span style={{ color: "var(--text-caption)" }}>·</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        gw {net.status.ipv4Gateway}
                      </span>
                    </>
                  )}
                </div>
                {net.config?.labels?.["com.apple.container.resource.role"] === "builtin" && (
                  <div style={{ marginTop: 4 }}>
                    <span className="badge neutral" style={{ fontSize: 10 }}>builtin</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedNetwork ? (
        <NetworkDetail
          network={selectedNetwork}
          onDelete={() => doDelete(selectedNetwork.id)}
          onClose={() => setSelected(null)}
        />
      ) : (
        <div className="detail-panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <NetworkIcon size={24} />
            </div>
            <p className="empty-state-title">Select a network</p>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateNetworkModal
          onClose={() => setShowCreate(false)}
          onCreate={async (name, subnet) => {
            await createNetwork(name, subnet);
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function NetworkDetail({
  network: net,
  onDelete,
  onClose,
}: {
  network: Network;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isBuiltin = net.config?.labels?.["com.apple.container.resource.role"] === "builtin";
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-icon">
          <NetworkIcon size={20} />
        </div>
        <div className="detail-title-area">
          <div className="detail-name">{net.id}</div>
          <div className="detail-subtitle">{net.config?.mode ?? "nat"}</div>
        </div>
        <div className="detail-actions">
          <span className={`badge ${net.state === "running" ? "running" : "stopped"}`}>
            <span className="badge-dot" />
            {net.state}
          </span>
          {!isBuiltin && !confirming && (
            <button className="btn-danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
          {confirming && (
            <>
              <button className="btn-danger" onClick={() => { onDelete(); setConfirming(false); }}>
                Confirm
              </button>
              <button className="btn-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={onClose} style={{ padding: "6px 8px" }}>
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="detail-body">
        <div className="section">
          <div className="section-header">
            <span className="section-title">Addressing</span>
          </div>
          <div className="info-grid cols3">
            <div className="info-cell">
              <div className="info-cell-label">IPv4 Subnet</div>
              <div className="info-cell-value mono">
                {net.status?.ipv4Subnet ?? "—"}
              </div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Gateway</div>
              <div className="info-cell-value mono">
                {net.status?.ipv4Gateway ?? "—"}
              </div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">IPv6 Subnet</div>
              <div className="info-cell-value mono" style={{ fontSize: 10 }}>
                {net.status?.ipv6Subnet ?? "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <span className="section-title">Configuration</span>
          </div>
          <div className="info-grid">
            <div className="info-cell">
              <div className="info-cell-label">Mode</div>
              <div className="info-cell-value">{net.config?.mode ?? "—"}</div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Plugin</div>
              <div className="info-cell-value" style={{ fontSize: 11 }}>
                {net.config?.pluginInfo?.plugin?.replace("container-network-", "") ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {net.config?.labels && Object.keys(net.config.labels).length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Labels</span>
            </div>
            {Object.entries(net.config.labels).map(([k, v]) => (
              <div
                key={k}
                style={{
                  padding: "7px 0",
                  borderBottom: "0.5px solid var(--border-subtle)",
                  fontSize: 12,
                  fontFamily: "SF Mono, Menlo, monospace",
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--teal)", minWidth: 160 }}>{k}</span>
                <span style={{ color: "var(--text-secondary)" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateNetworkModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, subnet?: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [subnet, setSubnet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), subnet.trim() || undefined);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-header">
          <span className="modal-title">Create Network</span>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <CloseIcon />
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-group">
          <label className="form-label">Network name *</label>
          <input
            type="text"
            placeholder="my-network"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Subnet (optional)</label>
          <input
            type="text"
            placeholder="192.168.100.0/24"
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!name.trim() || loading}
          >
            {loading ? <span className="spinner" /> : "Create"}
          </button>
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

function NetworkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9" />
    </svg>
  );
}
