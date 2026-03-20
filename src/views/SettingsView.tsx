import { useState, useEffect } from "react";
import type { AppSettings } from "../types";
import { getSettings, saveSettings } from "../api";

interface SettingsViewProps {
  onSettingsChange: (s: AppSettings) => void;
}

export function SettingsView({ onSettingsChange }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>({
    container_binary: "/usr/local/bin/container",
    refresh_interval: 5,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveSettings(settings);
      onSettingsChange(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-icon">
          <SettingsIcon size={20} />
        </div>
        <div className="detail-title-area">
          <div className="detail-name">Settings</div>
          <div className="detail-subtitle">Yana configuration</div>
        </div>
      </div>

      <div className="detail-body" style={{ maxWidth: 560 }}>
        {error && <div className="error-banner">{error}</div>}

        <div className="section">
          <div className="section-header">
            <span className="section-title">CLI</span>
          </div>

          <div className="form-group">
            <label className="form-label">Container binary path</label>
            <input
              type="text"
              value={settings.container_binary}
              onChange={(e) =>
                setSettings({ ...settings, container_binary: e.target.value })
              }
              placeholder="/usr/local/bin/container"
            />
            <p style={{ fontSize: 12, color: "var(--text-caption)", marginTop: 6 }}>
              Path to the <code style={{ fontFamily: "SF Mono, Menlo, monospace" }}>container</code> binary.
              Default: <code style={{ fontFamily: "SF Mono, Menlo, monospace" }}>/usr/local/bin/container</code>
            </p>
          </div>
        </div>

        <div className="divider" />

        <div className="section">
          <div className="section-header">
            <span className="section-title">Refresh</span>
          </div>

          <div className="form-group">
            <label className="form-label">Auto-refresh interval</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 5, 15, 30].map((s) => (
                <button
                  key={s}
                  className={
                    settings.refresh_interval === s
                      ? "btn-primary"
                      : "btn-secondary"
                  }
                  style={{ flex: 1 }}
                  onClick={() =>
                    setSettings({ ...settings, refresh_interval: s })
                  }
                >
                  {s}s
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-caption)", marginTop: 6 }}>
              How often to poll the container CLI for updates. Lower values use
              more CPU.
            </p>
          </div>
        </div>

        <div className="divider" />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner" />
                Saving…
              </>
            ) : (
              "Save settings"
            )}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: "var(--green)" }}>
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
