---
default: minor
---

# First public release with downloadable binaries

Every release now ships the headless `torrentx-server` for Linux (x86_64, aarch64) with its systemd unit, and the
desktop app for macOS (universal `.dmg`), Windows (`.msi`, setup `.exe`) and Linux (`.AppImage`, `.deb`), plus
`SHA256SUMS.txt`. A rolling `nightly` pre-release is rebuilt from every push to `main`.
