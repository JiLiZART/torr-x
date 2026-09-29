# Running TorrentX as a Linux service

`torrentx-server` is a single binary: it runs the torrent engine and serves the
web UI and HTTP API on one port (default `127.0.0.1:9977`).

## 1. Build

```bash
pnpm install
pnpm build:server          # builds the web UI, then target/release/torrentx-server
```

## 2. Install

```bash
# dedicated unprivileged user; its home holds engine state and downloads
sudo useradd --system --home-dir /var/lib/torrentx --create-home --shell /usr/sbin/nologin torrentx

sudo install -m 0755 target/release/torrentx-server /usr/local/bin/torrentx-server
sudo install -d -o torrentx -g torrentx -m 0750 /etc/torrentx
sudo install -m 0644 packaging/systemd/torrentx.service /etc/systemd/system/torrentx.service
```

On first start the server writes `/etc/torrentx/config.toml` with defaults
(mode `0600`, since it can hold the Transmission password).
Downloads go to `~torrentx/Downloads/TorrentX` (`/var/lib/torrentx/Downloads/TorrentX`)
unless you change `engine.rqbit.download_dir`.

## 3. Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now torrentx
systemctl status torrentx
journalctl -u torrentx -f
```

## 4. Remote access

By default the server listens on `127.0.0.1` only. To use it from another machine:

1. Open the UI (e.g. through an SSH tunnel: `ssh -L 9977:127.0.0.1:9977 server`, then
   browse to `http://localhost:9977`).
2. In **Settings**, enable authentication and set a username and password.
3. Set the bind address to `0.0.0.0` (or the LAN IP) and save.
4. `sudo systemctl restart torrentx`.

Without auth the server logs a warning when bound to a non-loopback address:
anyone who can reach the port controls your torrents.

Behind an HTTPS reverse proxy, forward the original `Host` header
(`proxy_set_header Host $host;` in nginx); the server rejects writes whose
`Origin` does not match `Host`.

## Config reference

```toml
[server]
bind = "127.0.0.1"
port = 9977
allowed_hosts = []        # extra Host names accepted when bound to loopback

[auth]
enabled = false
username = ""
password_hash = ""        # set from the UI (argon2id)

[engine]
kind = "rqbit"            # or "transmission"

[engine.rqbit]
download_dir = "/var/lib/torrentx/Downloads/TorrentX"

[engine.transmission]
host = "127.0.0.1"
port = 9091
path = "/transmission/rpc"
https = false
username = ""
password = ""

# The sections below are edited from the web UI; all keys are optional.
[network]
maxConnectionsPerTorrent = 0   # 0 = engine default
maxUploadKBps = 0              # 0 = unlimited
maxDownloadKBps = 0
listenPort = 0                 # 0 = engine default
upnp = true
proxy = { type = "none", host = "", port = 1080, authRequired = false, username = "", password = "" }

[downloads]
defaultSavePath = ""           # "" = the engine's own download directory
createSubfolder = true
moveCompletedEnabled = false
moveCompletedPath = ""
maxActiveDownloads = 0         # 0 = unlimited
maxActiveTorrents = 0
startAutomatically = true
defaultPriority = "normal"
seedAutomatically = true
minRatio = 0.0                 # 0 = no limit
minSeedingMinutes = 0

[advanced]
diskCacheMB = 0
dht = true
pex = true
lpd = true
sequentialDownload = false     # other toggles exist but no engine supports them yet

[preferences]                  # UI and desktop-app preferences
language = "en"                # en fr de es ru zh
theme = "hacker"               # hacker dark-blue light
```

CLI flags `--bind` and `--port` override the file for a single run.

Configs from before the split Transmission fields (`url = "..."`) are migrated on
first start; the original is kept as `config.v1.bak` next to `config.toml`.

Server state (user tabs, rename overrides, seeding bookkeeping) lives in
`state.json` in the data directory (`/var/lib/torrentx` for the service).

### Not available on a headless server

- **Show in file manager** only works for a browser on the same machine as the
  server, and needs a desktop session there. Remote browsers get `403`.
- **Start with system / start minimized / quit confirmation** are desktop-app
  settings; the service is started by systemd instead.

### Peer countries

Release builds (`pnpm build:server`) embed DB-IP's free "IP to Country Lite"
database, licensed CC BY 4.0 (https://db-ip.com). For other builds, run
`scripts/fetch-geoip.sh` or place `dbip-country-lite.mmdb` in the data directory;
without it the country column stays empty.

## Scripting

```bash
curl -u admin:secret http://127.0.0.1:9977/api/v1/torrents
curl -u admin:secret -H 'Content-Type: application/json' \
     -d '{"uri":"magnet:?xt=urn:btih:..."}' http://127.0.0.1:9977/api/v1/torrents
```
