// Types matching the container CLI JSON output

export interface ContainerMount {
  type: { tmpfs?: Record<string, never>; virtiofs?: Record<string, never> };
  source: string;
  destination: string;
  options: string[];
}

export interface ContainerNetwork {
  ipv4Address: string;
  ipv6Address?: string;
  ipv4Gateway: string;
  network: string;
  hostname: string;
  macAddress?: string;
}

export interface ContainerResources {
  cpus: number;
  memoryInBytes: number;
}

export interface ContainerInitProcess {
  executable: string;
  arguments: string[];
  environment: string[];
  workingDirectory: string;
  terminal: boolean;
  user?: { id?: { uid: number; gid: number } };
}

export interface ContainerImageDescriptor {
  digest: string;
  size: number;
  mediaType: string;
  annotations?: Record<string, string>;
}

export interface ContainerImage {
  reference: string;
  descriptor: ContainerImageDescriptor;
}

export interface ContainerDns {
  nameservers: string[];
  searchDomains: string[];
  options: string[];
  domain?: string;
}

export interface ContainerConfiguration {
  id: string;
  image: ContainerImage;
  mounts: ContainerMount[];
  publishedPorts: string[];
  networks: Array<{ network: string; options?: { hostname?: string } }>;
  resources: ContainerResources;
  platform: { os: string; architecture: string; variant?: string };
  initProcess: ContainerInitProcess;
  rosetta: boolean;
  useInit: boolean;
  ssh: boolean;
  readOnly: boolean;
  virtualization: boolean;
  runtimeHandler: string;
  labels: Record<string, string>;
  dns?: ContainerDns;
  sysctls?: Record<string, string>;
}

export interface Container {
  status: "running" | "stopped" | "created" | "paused";
  configuration: ContainerConfiguration;
  networks: ContainerNetwork[];
  startedDate?: number;
}

export interface ContainerStats {
  id: string;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  cpuUsageUsec: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  numProcesses: number;
}

// Images

export interface ImageDescriptor {
  digest: string;
  size: number;
  mediaType: string;
  annotations?: Record<string, string>;
}

export interface ImageInfo {
  reference: string;
  descriptor: ImageDescriptor;
  fullSize?: string;
}

// Networks

export interface NetworkStatus {
  ipv4Gateway: string;
  ipv4Subnet: string;
  ipv6Subnet?: string;
}

export interface NetworkConfig {
  id: string;
  mode: string;
  creationDate?: number;
  labels?: Record<string, string>;
  pluginInfo?: { plugin: string; variant: string };
}

export interface Network {
  id: string;
  config: NetworkConfig;
  state: "running" | "stopped";
  status?: NetworkStatus;
}

// System

export interface DiskUsageCategory {
  total: number;
  active: number;
  reclaimable: number;
  sizeInBytes: number;
}

export interface SystemDf {
  containers: DiskUsageCategory;
  images: DiskUsageCategory;
  volumes: DiskUsageCategory;
}

export interface SystemProperty {
  id: string;
  type: "Bool" | "String" | "Int";
  value: string | boolean | number | null;
  description: string;
}

// App settings

export interface AppSettings {
  container_binary: string;
  refresh_interval: number;
}

// Run container options

export interface RunContainerOptions {
  image: string;
  name?: string;
  detach: boolean;
  remove_on_stop: boolean;
  ports: string[];
  volumes: string[];
  env_vars: string[];
  working_dir?: string;
  command?: string;
  network?: string;
  cpus?: string;
  memory?: string;
}
