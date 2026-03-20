import { invoke } from "@tauri-apps/api/core";
import type {
  Container,
  ContainerStats,
  ImageInfo,
  Network,
  SystemDf,
  SystemProperty,
  AppSettings,
  RunContainerOptions,
} from "./types";

// Settings
export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) =>
  invoke<void>("save_settings", { settings });

// Version
export const getVersion = () => invoke<string>("get_version");

// Containers
export const listContainers = () => invoke<Container[]>("list_containers");
export const getContainerStats = () =>
  invoke<ContainerStats[]>("get_container_stats");
export const inspectContainer = (id: string) =>
  invoke<Container[]>("inspect_container", { id });
export const startContainer = (id: string) =>
  invoke<string>("start_container", { id });
export const stopContainer = (id: string) =>
  invoke<string>("stop_container", { id });
export const removeContainer = (id: string) =>
  invoke<string>("remove_container", { id });
export const getContainerLogs = (id: string, boot = false) =>
  invoke<string>("get_container_logs", { id, boot });
export const runContainer = (options: RunContainerOptions) =>
  invoke<string>("run_container", { options });
export const openShell = (id: string, shell = "sh") =>
  invoke<void>("open_shell", { id, shell });

// Images
export const listImages = () => invoke<ImageInfo[]>("list_images");
export const deleteImage = (reference: string) =>
  invoke<string>("delete_image", { reference });
export const pullImage = (reference: string) =>
  invoke<string>("pull_image", { reference });

// Networks
export const listNetworks = () => invoke<Network[]>("list_networks");
export const createNetwork = (name: string, subnet?: string) =>
  invoke<string>("create_network", { name, subnet: subnet ?? null });
export const deleteNetwork = (id: string) =>
  invoke<string>("delete_network", { id });

// DNS
export const listDns = () => invoke<string[]>("list_dns");

// System
export const systemDf = () => invoke<SystemDf>("system_df");
export const listSystemProperties = () =>
  invoke<SystemProperty[]>("list_system_properties");
export const setSystemProperty = (id: string, value: string) =>
  invoke<string>("set_system_property", { id, value });
export const systemStart = () => invoke<string>("system_start");
export const systemStop = () => invoke<string>("system_stop");
export const systemRestart = () => invoke<string>("system_restart");

// Helpers
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function memoryPercent(usage: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (usage / limit) * 100);
}
