// Mock data for peers
export const peers = [
  {
    ip: "192.168.1.105",
    client: "qBittorrent 4.5.2",
    country: "US",
    downloadSpeed: "3.2 MB/s",
    uploadSpeed: "0.5 MB/s",
    progress: 78,
  },
  {
    ip: "45.67.89.123",
    client: "Transmission 3.0",
    country: "DE",
    downloadSpeed: "2.8 MB/s",
    uploadSpeed: "0.3 MB/s",
    progress: 56,
  },
  {
    ip: "123.45.67.89",
    client: "µTorrent 2.2.1",
    country: "JP",
    downloadSpeed: "1.5 MB/s",
    uploadSpeed: "0.8 MB/s",
    progress: 92,
  },
  {
    ip: "78.90.12.34",
    client: "Deluge 2.0.5",
    country: "UK",
    downloadSpeed: "0.9 MB/s",
    uploadSpeed: "0.2 MB/s",
    progress: 34,
  },
  {
    ip: "12.34.56.78",
    client: "rTorrent 0.9.8",
    country: "CA",
    downloadSpeed: "2.1 MB/s",
    uploadSpeed: "0.4 MB/s",
    progress: 67,
  },
];
// Mock data for seeds
export const seeds = [
  {
    ip: "234.56.78.90",
    client: "qBittorrent 4.5.0",
    country: "FR",
    uploadSpeed: "1.2 MB/s",
    ratio: 3.5,
    uptime: "2d 5h",
  },
  {
    ip: "56.78.90.12",
    client: "Transmission 3.0",
    country: "NL",
    uploadSpeed: "2.4 MB/s",
    ratio: 8.2,
    uptime: "5d 12h",
  },
  {
    ip: "90.12.34.56",
    client: "µTorrent 2.2.1",
    country: "SE",
    uploadSpeed: "0.8 MB/s",
    ratio: 2.1,
    uptime: "1d 8h",
  },
  {
    ip: "34.56.78.90",
    client: "Deluge 2.0.3",
    country: "AU",
    uploadSpeed: "1.5 MB/s",
    ratio: 5.7,
    uptime: "3d 18h",
  },
  {
    ip: "78.90.12.34",
    client: "rTorrent 0.9.7",
    country: "BR",
    uploadSpeed: "0.9 MB/s",
    ratio: 4.2,
    uptime: "6d 3h",
  },
];

// Mock data for trackers
export const trackers = [
  {
    url: "udp://tracker.ubuntu.com:6969",
    status: "Working",
    peers: 362,
    seeds: 1250,
    latency: "12ms",
    lastChecked: "2 min ago",
  },
  {
    url: "udp://tracker.debian.org:6969",
    status: "Working",
    peers: 158,
    seeds: 543,
    latency: "45ms",
    lastChecked: "5 min ago",
  },
  {
    url: "udp://tracker.archlinux.org:6969",
    status: "Not Working",
    peers: 0,
    seeds: 0,
    latency: "-",
    lastChecked: "8 min ago",
  },
];
