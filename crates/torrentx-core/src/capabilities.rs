//! Which optional features the active engine supports (natively or via the server).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Every feature key the API reports. The UI gates its controls on these.
pub const FEATURE_KEYS: &[&str] = &[
    "filePriority",
    "fileSkip",
    "addPreview",
    "verify",
    "relocate",
    "rename",
    "addTracker",
    "trackerStatus",
    "peerList",
    "peerClient",
    "pieces",
    "torrentFile",
    "torrentPriority",
    "speedLimits",
    "maxConnectionsPerTorrent",
    "listenPort",
    "upnp",
    "proxyHttp",
    "proxySocks4",
    "proxySocks5",
    "queue",
    "seedLimits",
    "moveCompleted",
    "diskCache",
    "osCache",
    "superSeeding",
    "dht",
    "pex",
    "lpd",
    "anonymousMode",
    "sequentialDownload",
    "webSocketTrackers",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Via {
    Engine,
    Server,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feature {
    pub supported: bool,
    pub via: Option<Via>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Capabilities {
    pub engine: String,
    pub features: BTreeMap<String, Feature>,
}

impl Capabilities {
    /// All keys present and unsupported; engines then mark what they can do.
    pub fn new(engine: &str) -> Self {
        let features = FEATURE_KEYS
            .iter()
            .map(|k| {
                let f = Feature {
                    supported: false,
                    via: None,
                    note: None,
                };
                (k.to_string(), f)
            })
            .collect();
        Self {
            engine: engine.into(),
            features,
        }
    }

    fn set(mut self, keys: &[&str], via: Via, note: Option<&str>) -> Self {
        for k in keys {
            let f = self
                .features
                .get_mut(*k)
                .unwrap_or_else(|| panic!("unknown feature key {k}"));
            f.supported = true;
            f.via = Some(via);
            f.note = note.map(Into::into);
        }
        self
    }

    pub fn engine(self, keys: &[&str]) -> Self {
        self.set(keys, Via::Engine, None)
    }

    pub fn server(self, keys: &[&str]) -> Self {
        self.set(keys, Via::Server, None)
    }

    pub fn note(mut self, key: &str, note: &str) -> Self {
        if let Some(f) = self.features.get_mut(key) {
            f.note = Some(note.into());
        }
        self
    }

    pub fn supports(&self, key: &str) -> bool {
        self.features.get(key).is_some_and(|f| f.supported)
    }

    pub fn via(&self, key: &str) -> Option<Via> {
        self.features.get(key).and_then(|f| f.via)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builder_marks_features() {
        let c = Capabilities::new("x")
            .engine(&["fileSkip"])
            .server(&["queue"]);
        assert_eq!(c.features.len(), FEATURE_KEYS.len());
        assert!(c.supports("fileSkip"));
        assert_eq!(c.via("queue"), Some(Via::Server));
        assert!(!c.supports("superSeeding"));
    }
}
