import { useState, useEffect, useCallback } from "react";
import type { ImageInfo } from "../types";
import { listImages, deleteImage, pullImage } from "../api";

interface ImagesViewProps {
  refreshInterval: number;
}

export function ImagesView({ refreshInterval }: ImagesViewProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pullRef, setPullRef] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [showPullInput, setShowPullInput] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const imgs = await listImages();
      setImages(imgs);
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

  async function doPull() {
    if (!pullRef.trim()) return;
    setPulling(true);
    setPullError(null);
    try {
      await pullImage(pullRef.trim());
      setPullRef("");
      setShowPullInput(false);
      refresh();
    } catch (e) {
      setPullError(String(e));
    } finally {
      setPulling(false);
    }
  }

  async function doDelete(reference: string) {
    try {
      await deleteImage(reference);
      if (selected === reference) setSelected(null);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  const selectedImage = images.find((img) => img.reference === selected);

  return (
    <div className="main-content">
      {/* List */}
      <div className="list-panel">
        <div className="panel-header">
          <span className="panel-title">Images</span>
          <div className="panel-actions">
            {loading && <span className="spinner" />}
            <button className="btn-icon" onClick={refresh} title="Refresh">
              <RefreshIcon />
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowPullInput(true)}
              style={{ padding: "5px 12px", fontSize: 12 }}
            >
              <PlusIcon /> Pull
            </button>
          </div>
        </div>

        {showPullInput && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "0.5px solid var(--border-subtle)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              placeholder="e.g. ubuntu:latest"
              value={pullRef}
              onChange={(e) => setPullRef(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doPull()}
              autoFocus
              style={{ flex: 1, padding: "6px 10px", fontSize: 13 }}
            />
            <button className="btn-primary" onClick={doPull} disabled={pulling || !pullRef.trim()}>
              {pulling ? <span className="spinner" /> : "Pull"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => { setShowPullInput(false); setPullError(null); }}
            >
              Cancel
            </button>
          </div>
        )}

        {(error || pullError) && (
          <div className="error-banner" style={{ margin: "8px" }}>
            {error || pullError}
          </div>
        )}

        <div className="panel-body">
          {images.length === 0 && !loading ? (
            <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
              <div className="empty-state-icon">
                <ImageIcon size={24} />
              </div>
              <p className="empty-state-title">No images</p>
              <p className="empty-state-desc">Pull an image to get started</p>
            </div>
          ) : (
            images.map((img) => (
              <ImageListItem
                key={img.reference}
                image={img}
                selected={selected === img.reference}
                onClick={() =>
                  setSelected(selected === img.reference ? null : img.reference)
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      {selectedImage ? (
        <ImageDetail
          image={selectedImage}
          onDelete={() => doDelete(selectedImage.reference)}
          onClose={() => setSelected(null)}
        />
      ) : (
        <div className="detail-panel">
          <div className="empty-state">
            <div className="empty-state-icon">
              <ImageIcon size={24} />
            </div>
            <p className="empty-state-title">Select an image</p>
            <p className="empty-state-desc">
              Click an image to view details and digest
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageListItem({
  image: img,
  selected,
  onClick,
}: {
  image: ImageInfo;
  selected: boolean;
  onClick: () => void;
}) {
  // Pull out just the final image name
  const parts = img.reference.split("/");
  const name = parts[parts.length - 1];

  return (
    <div className={`list-item${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="list-item-header">
        <span className="list-item-name">{name}</span>
        {img.fullSize && (
          <span className="badge neutral" style={{ fontSize: 10 }}>
            {img.fullSize}
          </span>
        )}
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
        {img.reference}
      </div>
      <div className="list-item-meta" style={{ fontSize: 10 }}>
        <span
          style={{
            fontFamily: "SF Mono, Menlo, monospace",
            color: "var(--text-caption)",
          }}
        >
          {img.descriptor?.digest?.slice(0, 19) ?? "—"}
        </span>
      </div>
    </div>
  );
}

function ImageDetail({
  image: img,
  onDelete,
  onClose,
}: {
  image: ImageInfo;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-icon">
          <ImageIcon size={20} />
        </div>
        <div className="detail-title-area">
          <div className="detail-name">
            {(() => {
              const parts = img.reference.split("/");
              return parts[parts.length - 1];
            })()}
          </div>
          <div className="detail-subtitle">{img.reference}</div>
        </div>
        <div className="detail-actions">
          {!confirming ? (
            <button className="btn-danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          ) : (
            <>
              <button className="btn-danger" onClick={() => { onDelete(); setConfirming(false); }}>
                Confirm delete
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
            <span className="section-title">Details</span>
          </div>
          <div className="info-grid">
            <div className="info-cell">
              <div className="info-cell-label">Size</div>
              <div className="info-cell-value">{img.fullSize ?? "—"}</div>
            </div>
            <div className="info-cell">
              <div className="info-cell-label">Media Type</div>
              <div className="info-cell-value" style={{ fontSize: 11 }}>
                {img.descriptor?.mediaType?.replace("application/vnd.oci.image.", "") ?? "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <span className="section-title">Digest</span>
          </div>
          <div className="info-cell">
            <div className="info-cell-value mono" style={{ fontSize: 10, wordBreak: "break-all" }}>
              {img.descriptor?.digest ?? "—"}
            </div>
          </div>
        </div>

        {img.descriptor?.annotations && Object.keys(img.descriptor.annotations).length > 0 && (
          <div className="section">
            <div className="section-header">
              <span className="section-title">Annotations</span>
            </div>
            {Object.entries(img.descriptor.annotations).map(([k, v]) => (
              <div
                key={k}
                style={{
                  padding: "8px 0",
                  borderBottom: "0.5px solid var(--border-subtle)",
                  fontSize: 12,
                }}
              >
                <div style={{ color: "var(--text-caption)", marginBottom: 2, fontSize: 10 }}>{k}</div>
                <div style={{ color: "var(--text-secondary)", fontFamily: "SF Mono, Menlo, monospace" }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
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

function ImageIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <circle cx="7" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
