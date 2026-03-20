import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { ContainersView } from "./views/ContainersView";
import { ImagesView } from "./views/ImagesView";
import { NetworksView } from "./views/NetworksView";
import { VolumesView } from "./views/VolumesView";
import { DnsView } from "./views/DnsView";
import { SystemView } from "./views/SystemView";
import { SettingsView } from "./views/SettingsView";
import { getSettings, getVersion, listContainers, listImages } from "./api";
import type { AppSettings } from "./types";

export type View =
  | "containers"
  | "images"
  | "networks"
  | "volumes"
  | "dns"
  | "system"
  | "settings";

export default function App() {
  const [view, setView] = useState<View>("containers");
  const [settings, setSettings] = useState<AppSettings>({
    container_binary: "/usr/local/bin/container",
    refresh_interval: 5,
  });
  const [cliVersion, setCliVersion] = useState("");
  const [containerCount, setContainerCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [imageCount, setImageCount] = useState(0);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
    getVersion().then(setCliVersion).catch(() => {});
  }, []);

  useEffect(() => {
    async function updateCounts() {
      try {
        const [containers, images] = await Promise.all([
          listContainers(),
          listImages(),
        ]);
        setContainerCount(containers.length);
        setRunningCount(containers.filter((c) => c.status === "running").length);
        setImageCount(images.length);
      } catch {
        // ignore sidebar update errors
      }
    }
    updateCounts();
    const id = setInterval(updateCounts, settings.refresh_interval * 1000);
    return () => clearInterval(id);
  }, [settings.refresh_interval]);

  function handleSettingsChange(s: AppSettings) {
    setSettings(s);
    getVersion().then(setCliVersion).catch(() => {});
  }

  return (
    <div className="app-layout">
      <Sidebar
        current={view}
        onNavigate={setView}
        containerCount={containerCount}
        runningCount={runningCount}
        imageCount={imageCount}
        cliVersion={cliVersion}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
        {view === "containers" && (
          <ContainersView refreshInterval={settings.refresh_interval} />
        )}
        {view === "images" && (
          <ImagesView refreshInterval={settings.refresh_interval} />
        )}
        {view === "networks" && (
          <NetworksView refreshInterval={settings.refresh_interval} />
        )}
        {view === "volumes" && (
          <VolumesView refreshInterval={settings.refresh_interval} />
        )}
        {view === "dns" && (
          <DnsView refreshInterval={settings.refresh_interval} />
        )}
        {view === "system" && (
          <SystemView refreshInterval={settings.refresh_interval} />
        )}
        {view === "settings" && (
          <SettingsView onSettingsChange={handleSettingsChange} />
        )}
      </div>
    </div>
  );
}
