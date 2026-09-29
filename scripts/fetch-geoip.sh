#!/usr/bin/env sh
# Downloads DB-IP "IP to Country Lite" (CC BY 4.0, https://db-ip.com) for peer
# country lookup. Release builds embed it with `--features geoip`.
set -eu
dest="$(cd "$(dirname "$0")/.." && pwd)/crates/torrentx-server/geoip/dbip-country-lite.mmdb"
mkdir -p "$(dirname "$dest")"
# The current month's file may not be published yet; fall back to last month.
for month in "$(date -u +%Y-%m)" "$(date -u -v-1m +%Y-%m 2>/dev/null || date -u -d '1 month ago' +%Y-%m)"; do
  url="https://download.db-ip.com/free/dbip-country-lite-$month.mmdb.gz"
  if curl -fsSL "$url" | gunzip > "$dest.tmp"; then
    mv "$dest.tmp" "$dest"
    echo "GeoIP database: $dest ($month)"
    exit 0
  fi
done
rm -f "$dest.tmp"
echo "failed to download the DB-IP country database" >&2
exit 1
