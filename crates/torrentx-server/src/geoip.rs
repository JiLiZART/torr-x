//! Peer country lookup from DB-IP "IP to Country Lite" (CC BY 4.0, https://db-ip.com).
//! Release builds with the `geoip` feature embed the database fetched by
//! `scripts/fetch-geoip.sh`; otherwise it is read from `<data_dir>/dbip-country-lite.mmdb`
//! or the crate's `geoip/` folder. Without a database every country is null.

use std::net::{IpAddr, SocketAddr};
use std::path::Path;

use maxminddb::{Reader, geoip2};

pub const DB_FILE: &str = "dbip-country-lite.mmdb";

#[cfg(feature = "geoip")]
static EMBEDDED: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/geoip/dbip-country-lite.mmdb"
));

pub struct GeoIp(Option<Reader<Vec<u8>>>);

impl GeoIp {
    pub fn load(data_dir: &Path) -> Self {
        #[cfg(feature = "geoip")]
        let embedded = Some(EMBEDDED.to_vec());
        #[cfg(not(feature = "geoip"))]
        let embedded: Option<Vec<u8>> = None;
        let bytes = embedded.or_else(|| {
            [
                data_dir.join(DB_FILE),
                Path::new(env!("CARGO_MANIFEST_DIR")).join("geoip").join(DB_FILE),
            ]
            .iter()
            .find_map(|p| std::fs::read(p).ok())
        });
        let reader = bytes.and_then(|b| match Reader::from_source(b) {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!("invalid GeoIP database: {e}");
                None
            }
        });
        if reader.is_none() {
            tracing::debug!("no GeoIP database; peer countries are unknown");
        }
        Self(reader)
    }

    /// ISO 3166 code for `"ip"` or `"ip:port"`.
    pub fn country(&self, address: &str) -> Option<String> {
        let reader = self.0.as_ref()?;
        let ip = address
            .parse::<SocketAddr>()
            .map(|a| a.ip())
            .or_else(|_| address.parse::<IpAddr>())
            .ok()?;
        let found = reader.lookup(ip).ok()?;
        let country = found.decode::<geoip2::Country>().ok()??;
        country.country.iso_code.map(String::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_when_database_present() {
        let g = GeoIp::load(Path::new("/nonexistent"));
        if g.0.is_none() {
            eprintln!("skipped: no GeoIP database (run scripts/fetch-geoip.sh)");
            return;
        }
        // Google public DNS is registered in the US.
        assert_eq!(g.country("8.8.8.8:53").as_deref(), Some("US"));
        assert_eq!(g.country("127.0.0.1"), None);
        assert_eq!(g.country("garbage"), None);
    }
}
