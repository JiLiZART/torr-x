//! Server-owned metadata in `<data_dir>/state.json`: saved-query tabs, torrent
//! tags, rename overrides and policy bookkeeping. Keyed by info-hash, so it
//! survives engine switches and rqbit forget/re-add.

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Deserializer, Serialize};

use crate::covers::CoverRec;

/// Version of the query grammar tab queries were written in (`@torrentx/query`).
/// The server stores query text verbatim and never parses it.
pub const GRAMMAR_VERSION: u32 = 1;
/// state.json layout: 3 = saved-query tabs + tags (2 had membership tabs).
const VERSION: u32 = 3;
/// The fallback view for stale addresses; the only tab that cannot be deleted.
pub const ALL_TAB: &str = "all";
const MAX_TAGS: usize = 32;
const MAX_TAG_CHARS: usize = 64;

/// A saved query. An empty `name` means "named by its query" (ad-hoc).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: String,
    pub name: String,
    pub query: String,
    /// Position in the list; derived on read.
    #[serde(default)]
    pub order: usize,
    pub pinned: bool,
    pub group: Option<String>,
}

/// Partial update; absent fields stay. `group: null` ungroups.
#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TabPatch {
    pub name: Option<String>,
    pub query: Option<String>,
    pub order: Option<usize>,
    pub pinned: Option<bool>,
    #[serde(deserialize_with = "present")]
    pub group: Option<Option<String>>,
}

/// Tells `"group": null` (Some(None)) from an absent key (None).
fn present<'de, T: Deserialize<'de>, D: Deserializer<'de>>(d: D) -> Result<Option<T>, D::Error> {
    T::deserialize(d).map(Some)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PausedBy {
    Queue,
    Seeding,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PolicyRec {
    /// Unix seconds when the torrent was first seen complete.
    pub seeding_since: Option<i64>,
    /// Set when the policy loop paused it; the loop never resumes user pauses.
    pub paused_by: Option<PausedBy>,
    /// Move-completed already done.
    pub moved: bool,
    /// Seeding limit already enforced once; a later user resume is respected.
    pub seed_limit_hit: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Data {
    version: u32,
    grammar_version: u32,
    tabs: Vec<Tab>,
    next_tab: u64,
    tags: BTreeMap<String, Vec<String>>,
    categories: BTreeMap<String, String>,
    names: BTreeMap<String, String>,
    policy: BTreeMap<String, PolicyRec>,
    /// Cover records; absent in files written before covers existed.
    covers: BTreeMap<String, CoverRec>,
}

/// state.json before version 3: named tabs with one tab per torrent.
#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct LegacyData {
    tabs: Vec<(String, String)>,
    next_tab: u64,
    assignments: BTreeMap<String, String>,
    names: BTreeMap<String, String>,
    policy: BTreeMap<String, PolicyRec>,
}

fn builtin_tabs() -> Vec<Tab> {
    [
        (ALL_TAB, "All", "", true),
        ("downloading", "Downloading", "state:downloading", true),
        ("active", "Active", "state:active sort:added desc", false),
        ("seeding", "Seeding", "state:seeding", false),
        ("stalled", "Stalled", "state:stalled", false),
    ]
    .into_iter()
    .map(|(id, name, query, pinned)| Tab {
        id: id.into(),
        name: name.into(),
        query: query.into(),
        order: 0,
        pinned,
        group: None,
    })
    .collect()
}

/// Tag for a legacy tab name: lowercase, runs of other characters become `-`.
fn slug(name: &str, fallback: &str) -> String {
    let mut out = String::new();
    for c in name.to_lowercase().chars() {
        if c.is_alphanumeric() {
            out.push(c);
        } else if !out.is_empty() && !out.ends_with('-') {
            out.push('-');
        }
    }
    let out: String = out.trim_end_matches('-').chars().take(MAX_TAG_CHARS).collect();
    if out.is_empty() { fallback.to_string() } else { out }
}

/// Membership becomes tags: each old tab keeps its torrents as `tag:<slug>`.
/// Built-in tabs are seeded here (first run and migration), so deleting one sticks.
fn migrate(old: LegacyData) -> Data {
    let mut used = HashSet::new();
    let mut slugs = BTreeMap::new();
    for (id, name) in &old.tabs {
        let mut tag = slug(name, id);
        if !used.insert(tag.clone()) {
            tag = format!("{tag}-{id}");
            used.insert(tag.clone());
        }
        slugs.insert(id.clone(), tag);
    }
    let mut tabs = builtin_tabs();
    tabs.extend(old.tabs.iter().map(|(id, name)| Tab {
        id: id.clone(),
        name: name.clone(),
        query: format!("tag:{}", slugs[id]),
        order: 0,
        pinned: false,
        group: None,
    }));
    let tags = old
        .assignments
        .iter()
        .filter_map(|(torrent, tab)| Some((torrent.clone(), vec![slugs.get(tab)?.clone()])))
        .collect();
    Data {
        version: VERSION,
        grammar_version: GRAMMAR_VERSION,
        tabs,
        next_tab: old.next_tab,
        tags,
        categories: BTreeMap::new(),
        names: old.names,
        policy: old.policy,
        covers: BTreeMap::new(),
    }
}

/// Trimmed, lowercased, deduplicated; at most 32 tags of at most 64 characters.
fn normalize_tags(tags: &[String]) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for tag in tags {
        let tag = tag.trim().to_lowercase();
        if tag.chars().count() > MAX_TAG_CHARS {
            return Err(format!("a tag is at most {MAX_TAG_CHARS} characters"));
        }
        if !tag.is_empty() && !out.contains(&tag) {
            out.push(tag);
        }
    }
    if out.len() > MAX_TAGS {
        return Err(format!("a torrent has at most {MAX_TAGS} tags"));
    }
    Ok(out)
}

fn clean_group(group: Option<String>) -> Option<String> {
    group.map(|g| g.trim().to_string()).filter(|g| !g.is_empty())
}

pub struct Store {
    path: PathBuf,
    data: Mutex<Data>,
}

impl Store {
    pub fn load(data_dir: &Path) -> Result<Self, String> {
        let path = data_dir.join("state.json");
        let invalid = |e: serde_json::Error| format!("invalid state file {}: {e}", path.display());
        let (data, migrated) = match std::fs::read_to_string(&path) {
            Ok(t) => {
                let value: serde_json::Value = serde_json::from_str(&t).map_err(invalid)?;
                if value["version"].as_u64().unwrap_or(0) >= u64::from(VERSION) {
                    (serde_json::from_value(value).map_err(invalid)?, false)
                } else {
                    (migrate(serde_json::from_value(value).map_err(invalid)?), true)
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                (migrate(LegacyData::default()), false)
            }
            Err(e) => return Err(format!("cannot read {}: {e}", path.display())),
        };
        let store = Self {
            path,
            data: Mutex::new(data),
        };
        if migrated {
            store.write(|_| Ok(()))?;
        }
        Ok(store)
    }

    /// Runs `f` on the data and persists if it returns Ok.
    fn write<T>(&self, f: impl FnOnce(&mut Data) -> Result<T, String>) -> Result<T, String> {
        let mut data = self.data.lock().unwrap();
        let out = f(&mut data)?;
        let text = serde_json::to_string_pretty(&*data).map_err(|e| e.to_string())?;
        let err = |e: std::io::Error| format!("cannot write {}: {e}", self.path.display());
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir).map_err(err)?;
        }
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, text).map_err(err)?;
        std::fs::rename(&tmp, &self.path).map_err(err)?;
        Ok(out)
    }

    pub fn grammar_version(&self) -> u32 {
        self.data.lock().unwrap().grammar_version
    }

    pub fn tabs(&self) -> Vec<Tab> {
        let data = self.data.lock().unwrap();
        let numbered = data.tabs.iter().cloned().enumerate();
        numbered.map(|(order, tab)| Tab { order, ..tab }).collect()
    }

    fn tab(&self, id: &str) -> Option<Tab> {
        self.tabs().into_iter().find(|t| t.id == id)
    }

    /// `query` is stored verbatim, parseable or not.
    pub fn create_tab(
        &self,
        name: &str,
        query: &str,
        pinned: bool,
        group: Option<String>,
    ) -> Result<Tab, String> {
        let id = self.write(|d| {
            d.next_tab += 1;
            let id = format!("t{}", d.next_tab);
            d.tabs.push(Tab {
                id: id.clone(),
                name: name.trim().into(),
                query: query.into(),
                order: 0,
                pinned,
                group: clean_group(group),
            });
            Ok(id)
        })?;
        Ok(self.tab(&id).expect("just created"))
    }

    /// Ok(None) when the tab does not exist. `order` moves the tab to that position.
    pub fn update_tab(&self, id: &str, patch: TabPatch) -> Result<Option<Tab>, String> {
        let found = self.write(|d| {
            let Some(at) = d.tabs.iter().position(|t| t.id == id) else {
                return Ok(false);
            };
            let mut tab = d.tabs.remove(at);
            if let Some(name) = patch.name {
                tab.name = name.trim().into();
            }
            if let Some(query) = patch.query {
                tab.query = query;
            }
            if let Some(pinned) = patch.pinned {
                tab.pinned = pinned;
            }
            if let Some(group) = patch.group {
                tab.group = clean_group(group);
            }
            let to = patch.order.unwrap_or(at).min(d.tabs.len());
            d.tabs.insert(to, tab);
            Ok(true)
        })?;
        Ok(found.then(|| self.tab(id)).flatten())
    }

    /// Ok(false) when the tab does not exist; Err for the All tab.
    pub fn delete_tab(&self, id: &str) -> Result<bool, String> {
        if id == ALL_TAB {
            return Err("the All tab cannot be deleted".into());
        }
        self.write(|d| {
            let before = d.tabs.len();
            d.tabs.retain(|t| t.id != id);
            Ok(d.tabs.len() != before)
        })
    }

    /// Replaces the torrent's tags with the normalized set.
    pub fn set_tags(&self, torrent: &str, tags: &[String]) -> Result<(), String> {
        let tags = normalize_tags(tags)?;
        self.write(|d| {
            if tags.is_empty() {
                d.tags.remove(torrent);
            } else {
                d.tags.insert(torrent.into(), tags);
            }
            Ok(())
        })
    }

    pub fn tags_of(&self, torrent: &str) -> Vec<String> {
        let data = self.data.lock().unwrap();
        data.tags.get(torrent).cloned().unwrap_or_default()
    }

    /// Sets the torrent's category (trimmed, at most 64 characters); empty clears it.
    pub fn set_category(&self, torrent: &str, category: &str) -> Result<(), String> {
        let category = category.trim().to_string();
        if category.chars().count() > MAX_TAG_CHARS {
            return Err(format!("a category is at most {MAX_TAG_CHARS} characters"));
        }
        self.write(|d| {
            if category.is_empty() {
                d.categories.remove(torrent);
            } else {
                d.categories.insert(torrent.into(), category);
            }
            Ok(())
        })
    }

    pub fn category_of(&self, torrent: &str) -> Option<String> {
        self.data.lock().unwrap().categories.get(torrent).cloned()
    }

    pub fn name_of(&self, torrent: &str) -> Option<String> {
        self.data.lock().unwrap().names.get(torrent).cloned()
    }

    pub fn set_name(&self, torrent: &str, name: &str) -> Result<(), String> {
        let name = clean_name(name)?;
        self.write(|d| {
            d.names.insert(torrent.into(), name);
            Ok(())
        })
    }

    /// Drops everything known about a removed torrent.
    pub fn forget(&self, torrent: &str) -> Result<(), String> {
        self.write(|d| {
            d.tags.remove(torrent);
            d.categories.remove(torrent);
            d.names.remove(torrent);
            d.policy.remove(torrent);
            d.covers.remove(torrent);
            Ok(())
        })
    }

    pub fn covers(&self, torrent: &str) -> CoverRec {
        let data = self.data.lock().unwrap();
        data.covers.get(torrent).cloned().unwrap_or_default()
    }

    /// Changes the torrent's cover record; an empty record is dropped.
    pub fn update_covers(&self, torrent: &str, f: impl FnOnce(&mut CoverRec)) -> Result<(), String> {
        self.write(|d| {
            let mut rec = d.covers.remove(torrent).unwrap_or_default();
            f(&mut rec);
            if rec != CoverRec::default() {
                d.covers.insert(torrent.into(), rec);
            }
            Ok(())
        })
    }

    pub fn policy(&self, torrent: &str) -> PolicyRec {
        let data = self.data.lock().unwrap();
        data.policy.get(torrent).cloned().unwrap_or_default()
    }

    /// Persists only when the record actually changed.
    pub fn set_policy(&self, torrent: &str, rec: PolicyRec) -> Result<(), String> {
        if self.policy(torrent) == rec {
            return Ok(());
        }
        self.write(|d| {
            if rec == PolicyRec::default() {
                d.policy.remove(torrent);
            } else {
                d.policy.insert(torrent.into(), rec);
            }
            Ok(())
        })
    }
}

fn clean_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        Err("name must not be empty".into())
    } else {
        Ok(name.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("torrentx-store-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn tabs_lifecycle_and_persistence() {
        let d = dir("tabs");
        let s = Store::load(&d).unwrap();
        let ids = |s: &Store| s.tabs().into_iter().map(|t| t.id).collect::<Vec<_>>();
        assert_eq!(ids(&s), ["all", "downloading", "active", "seeding", "stalled"]);
        assert!(s.tabs()[0].pinned && s.tabs()[0].query.is_empty());

        // Query text is stored verbatim, even when it does not parse.
        let bad = s.create_tab(" ", "statu:active", false, Some(" Media ".into())).unwrap();
        assert_eq!((bad.name.as_str(), bad.query.as_str()), ("", "statu:active"));
        assert_eq!((bad.order, bad.group.as_deref()), (5, Some("Media")));

        let patch = |json: &str| serde_json::from_str::<TabPatch>(json).unwrap();
        let moved = s.update_tab(&bad.id, patch(r#"{"order":0,"name":"Bad","pinned":true}"#));
        let moved = moved.unwrap().unwrap();
        assert_eq!((moved.order, moved.name.as_str(), moved.pinned), (0, "Bad", true));
        assert_eq!(moved.group.as_deref(), Some("Media"), "absent group stays");
        let ungrouped = s.update_tab(&bad.id, patch(r#"{"group":null,"order":99}"#)).unwrap().unwrap();
        assert_eq!((ungrouped.group, ungrouped.order), (None, 5));
        assert!(s.update_tab("nope", TabPatch::default()).unwrap().is_none());

        // Survives a restart; deleted built-ins are not seeded again.
        assert!(s.delete_tab("stalled").unwrap());
        assert!(!s.delete_tab("stalled").unwrap());
        assert!(s.delete_tab(ALL_TAB).is_err());
        let s = Store::load(&d).unwrap();
        assert_eq!(ids(&s), ["all", "downloading", "active", "seeding", bad.id.as_str()]);
        assert_eq!(s.grammar_version(), GRAMMAR_VERSION);
        let again = s.create_tab("New", "", false, None).unwrap();
        assert_ne!(again.id, bad.id, "ids are never reused");
        let _ = std::fs::remove_dir_all(d);
    }

    #[test]
    fn tags_are_normalized_and_limited() {
        let d = dir("tags");
        let s = Store::load(&d).unwrap();
        let tags = |list: &[&str]| list.iter().map(|t| t.to_string()).collect::<Vec<_>>();
        s.set_tags("aa", &tags(&[" 4K ", "4k", "Movies", " "])).unwrap();
        assert_eq!(s.tags_of("aa"), ["4k", "movies"]);

        let many: Vec<String> = (0..33).map(|i| format!("t{i}")).collect();
        assert!(s.set_tags("aa", &many).is_err());
        assert!(s.set_tags("aa", &["x".repeat(65)]).is_err());
        assert_eq!(s.tags_of("aa"), ["4k", "movies"], "a rejected set changes nothing");
        s.set_tags("bb", &many[..32]).unwrap();
        s.set_tags("bb", &["é".repeat(64)]).unwrap();

        let s = Store::load(&d).unwrap();
        assert_eq!(s.tags_of("aa"), ["4k", "movies"]);
        s.set_tags("aa", &[]).unwrap();
        assert!(s.tags_of("aa").is_empty());
        s.set_category("aa", "  Movies ").unwrap();
        assert_eq!(s.category_of("aa").as_deref(), Some("Movies"));
        assert!(s.set_category("aa", &"x".repeat(65)).is_err());
        s.set_category("aa", " ").unwrap();
        assert_eq!(s.category_of("aa"), None);
        let _ = std::fs::remove_dir_all(d);
    }

    #[test]
    fn v2_state_migrates_to_tags() {
        let d = dir("migrate");
        std::fs::create_dir_all(&d).unwrap();
        let v2 = r#"{
            "tabs": [["t1", "Media"], ["t2", "4K Movies!"], ["t3", "media"], ["t4", "!!"]],
            "nextTab": 4,
            "assignments": { "aa": "t1", "bb": "t2", "cc": "t3", "dd": "gone" },
            "names": { "aa": "Nice" },
            "policy": { "aa": { "moved": true } }
        }"#;
        std::fs::write(d.join("state.json"), v2).unwrap();
        let s = Store::load(&d).unwrap();

        let tabs = s.tabs();
        assert_eq!(tabs.len(), 9, "five built-ins + four migrated");
        let query = |id: &str| tabs.iter().find(|t| t.id == id).unwrap().query.clone();
        assert_eq!(query("t1"), "tag:media");
        assert_eq!(query("t2"), "tag:4k-movies");
        assert_eq!(query("t3"), "tag:media-t3", "colliding names keep separate membership");
        assert_eq!(query("t4"), "tag:t4");
        assert_eq!(s.tags_of("aa"), ["media"]);
        assert_eq!(s.tags_of("bb"), ["4k-movies"]);
        assert_eq!(s.tags_of("cc"), ["media-t3"]);
        assert!(s.tags_of("dd").is_empty());
        assert_eq!(s.name_of("aa").as_deref(), Some("Nice"));
        assert!(s.policy("aa").moved);

        // Written back as v3 on load; loading again changes nothing.
        let text = std::fs::read_to_string(d.join("state.json")).unwrap();
        let saved: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!((saved["version"].as_u64(), saved["grammarVersion"].as_u64()), (Some(3), Some(1)));
        assert!(saved.get("assignments").is_none());
        assert_eq!(Store::load(&d).unwrap().tabs(), tabs);
        assert_eq!(s.create_tab("New", "", false, None).unwrap().id, "t5");
        let _ = std::fs::remove_dir_all(d);
    }

    #[test]
    fn names_policy_and_forget() {
        let d = dir("meta");
        let s = Store::load(&d).unwrap();
        s.set_name("aa", "Nice").unwrap();
        let rec = PolicyRec {
            seeding_since: Some(5),
            paused_by: Some(PausedBy::Queue),
            moved: false,
            seed_limit_hit: true,
        };
        s.set_policy("aa", rec.clone()).unwrap();
        let s = Store::load(&d).unwrap();
        assert_eq!(s.name_of("aa").as_deref(), Some("Nice"));
        assert_eq!(s.policy("aa"), rec);
        // An old state.json has no `covers`; records written now survive a restart.
        assert_eq!(s.covers("aa"), CoverRec::default());
        s.update_covers("aa", |r| {
            r.removed.insert("torrent".into());
            r.looked_up.insert("3".into());
        })
        .unwrap();
        let s = Store::load(&d).unwrap();
        assert!(s.covers("aa").removed.contains("torrent") && s.covers("aa").looked_up.contains("3"));
        s.forget("aa").unwrap();
        assert_eq!(s.name_of("aa"), None);
        assert_eq!(s.policy("aa"), PolicyRec::default());
        assert_eq!(s.covers("aa"), CoverRec::default());
        let _ = std::fs::remove_dir_all(d);
    }
}
