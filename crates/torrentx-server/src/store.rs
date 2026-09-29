//! Server-owned metadata in `<data_dir>/state.json`: user tabs, torrent→tab
//! assignments, rename overrides and policy bookkeeping. Keyed by info-hash, so
//! it survives engine switches and rqbit forget/re-add.

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: String,
    pub name: String,
    pub torrent_ids: Vec<String>,
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
    tabs: Vec<(String, String)>,
    next_tab: u64,
    assignments: BTreeMap<String, String>,
    names: BTreeMap<String, String>,
    policy: BTreeMap<String, PolicyRec>,
}

pub struct Store {
    path: PathBuf,
    data: Mutex<Data>,
}

impl Store {
    pub fn load(data_dir: &Path) -> Result<Self, String> {
        let path = data_dir.join("state.json");
        let data = match std::fs::read_to_string(&path) {
            Ok(t) => serde_json::from_str(&t)
                .map_err(|e| format!("invalid state file {}: {e}", path.display()))?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Data::default(),
            Err(e) => return Err(format!("cannot read {}: {e}", path.display())),
        };
        Ok(Self {
            path,
            data: Mutex::new(data),
        })
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

    /// User tabs; torrents not in `known` (e.g. from another engine) are hidden.
    pub fn tabs(&self, known: Option<&HashSet<String>>) -> Vec<Tab> {
        let data = self.data.lock().unwrap();
        data.tabs
            .iter()
            .map(|(id, name)| Tab {
                id: id.clone(),
                name: name.clone(),
                torrent_ids: data
                    .assignments
                    .iter()
                    .filter(|(t, tab)| *tab == id && known.is_none_or(|k| k.contains(*t)))
                    .map(|(t, _)| t.clone())
                    .collect(),
            })
            .collect()
    }

    fn tab(&self, id: &str) -> Option<Tab> {
        self.tabs(None).into_iter().find(|t| t.id == id)
    }

    pub fn create_tab(&self, name: &str) -> Result<Tab, String> {
        let name = clean_name(name)?;
        let id = self.write(|d| {
            d.next_tab += 1;
            let id = format!("t{}", d.next_tab);
            d.tabs.push((id.clone(), name));
            Ok(id)
        })?;
        Ok(self.tab(&id).expect("just created"))
    }

    /// Ok(None) when the tab does not exist.
    pub fn rename_tab(&self, id: &str, name: &str) -> Result<Option<Tab>, String> {
        let name = clean_name(name)?;
        let found = self.write(|d| {
            Ok(d.tabs.iter_mut().find(|(t, _)| t == id).map(|t| t.1 = name).is_some())
        })?;
        Ok(found.then(|| self.tab(id)).flatten())
    }

    /// Returns false when the tab does not exist. Its torrents become unassigned.
    pub fn delete_tab(&self, id: &str) -> Result<bool, String> {
        self.write(|d| {
            let before = d.tabs.len();
            d.tabs.retain(|(t, _)| t != id);
            d.assignments.retain(|_, tab| tab != id);
            Ok(d.tabs.len() != before)
        })
    }

    /// `tab = None` unassigns. Err on an unknown tab.
    pub fn assign(&self, torrent: &str, tab: Option<&str>) -> Result<(), String> {
        self.write(|d| {
            match tab {
                Some(tab) if !d.tabs.iter().any(|(t, _)| t == tab) => {
                    return Err(format!("tab {tab} not found"));
                }
                Some(tab) => d.assignments.insert(torrent.into(), tab.into()),
                None => d.assignments.remove(torrent),
            };
            Ok(())
        })
    }

    pub fn tab_of(&self, torrent: &str) -> Option<String> {
        self.data.lock().unwrap().assignments.get(torrent).cloned()
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
            d.assignments.remove(torrent);
            d.names.remove(torrent);
            d.policy.remove(torrent);
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
        assert!(s.create_tab("   ").is_err());
        let linux = s.create_tab(" Linux ").unwrap();
        assert_eq!(linux.name, "Linux");
        let other = s.create_tab("Other").unwrap();
        assert_ne!(linux.id, other.id);

        s.assign("aa", Some(&linux.id)).unwrap();
        s.assign("bb", Some(&linux.id)).unwrap();
        s.assign("bb", Some(&other.id)).unwrap();
        assert!(s.assign("cc", Some("nope")).is_err());
        assert_eq!(s.rename_tab(&linux.id, "Distros").unwrap().unwrap().name, "Distros");
        assert!(s.rename_tab("nope", "x").unwrap().is_none());

        // Survives a restart; unknown torrents are hidden, not dropped.
        let s = Store::load(&d).unwrap();
        let tabs = s.tabs(None);
        assert_eq!(tabs[0].name, "Distros");
        assert_eq!(tabs[0].torrent_ids, vec!["aa"]);
        assert_eq!(tabs[1].torrent_ids, vec!["bb"]);
        let known: HashSet<String> = ["bb".to_string()].into();
        assert!(s.tabs(Some(&known))[0].torrent_ids.is_empty());
        assert_eq!(s.tab_of("aa").as_deref(), Some(linux.id.as_str()));

        // Deleting a tab unassigns its torrents.
        assert!(s.delete_tab(&linux.id).unwrap());
        assert!(!s.delete_tab(&linux.id).unwrap());
        assert_eq!(s.tab_of("aa"), None);
        let again = s.create_tab("New").unwrap();
        assert_ne!(again.id, linux.id, "ids are never reused");
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
        s.forget("aa").unwrap();
        assert_eq!(s.name_of("aa"), None);
        assert_eq!(s.policy("aa"), PolicyRec::default());
        let _ = std::fs::remove_dir_all(d);
    }
}
