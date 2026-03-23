import { invoke } from "@tauri-apps/api/tauri";

export interface TorrentInfo {
  id: string;
  name: string;
  size: number;
  status: "downloading" | "seeding" | "paused" | "checking" | "error";
  progress: number;
  seeds: number;
  peers: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: string;
  error?: string;
}

export type BackendType = "transmission" | "internal";

class TorrentAPI {
  private currentBackend: BackendType = "internal";

  async setBackend(backend: BackendType): Promise<void> {
    await invoke("set_backend", { backend });
    this.currentBackend = backend;
  }

  async addTorrent(magnetOrUrl: string): Promise<string> {
    return invoke("add_torrent", { magnetOrUrl });
  }

  async getTorrents(): Promise<TorrentInfo[]> {
    const torrents = await invoke<TorrentInfo[]>("get_torrents");
    return torrents.map((t) => ({
      ...t,
      // Convert bytes to human readable format
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      // Format ETA
      eta: this.formatEta(t),
    }));
  }

  async pauseTorrent(id: string): Promise<void> {
    await invoke("pause_torrent", { id });
  }

  async resumeTorrent(id: string): Promise<void> {
    await invoke("resume_torrent", { id });
  }

  async removeTorrent(id: string, deleteFiles: boolean = false): Promise<void> {
    await invoke("remove_torrent", { id, deleteFiles });
  }

  async getTorrentDetails(id: string): Promise<TorrentInfo> {
    return invoke("get_torrent_info", { id });
  }

  private formatEta(torrent: TorrentInfo): string {
    if (torrent.status === "seeding" || torrent.progress === 100) {
      return "-";
    }
    if (torrent.status === "paused") {
      return "paused";
    }
    if (torrent.downloadSpeed === 0) {
      return "∞";
    }

    // Calculate ETA based on remaining bytes and current speed
    const remainingBytes = (1 - torrent.progress / 100) * torrent.size;
    const seconds = remainingBytes / torrent.downloadSpeed;

    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    }
    if (seconds < 3600) {
      return `${Math.ceil(seconds / 60)}m`;
    }
    return `${Math.floor(seconds / 3600)}h ${Math.ceil(
      (seconds % 3600) / 60
    )}m`;
  }
}

export const torrentAPI = new TorrentAPI();
