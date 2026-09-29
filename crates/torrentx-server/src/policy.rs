//! Background loop: queue limits, seeding limits and move-completed for features
//! the engine lacks (capability `via: server`), plus added/completed events.
//! Decisions are a pure function of (now, torrents, records, settings) for testing.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use torrentx_core::{Capabilities, DownloadSettings, Status, Torrent, Via};

use crate::store::{PausedBy, PolicyRec};
use crate::{AppState, ServerEvent};

const TICK: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Pause(String),
    Resume(String),
    Relocate(String, String),
}

fn done(t: &Torrent) -> bool {
    t.progress >= 1.0
}

/// Added/completed events between two polls. No events on the first poll.
pub fn events(prev: Option<&HashMap<String, f64>>, list: &[Torrent]) -> Vec<ServerEvent> {
    let Some(prev) = prev else { return Vec::new() };
    list.iter()
        .filter_map(|t| {
            let (id, name) = (t.id.clone(), t.name.clone());
            match prev.get(&t.id) {
                None => Some(ServerEvent::TorrentAdded { id, name }),
                Some(p) if *p < 1.0 && done(t) => Some(ServerEvent::TorrentCompleted { id, name }),
                _ => None,
            }
        })
        .collect()
}

/// Returns the actions to run and the updated records (only changed ones).
pub fn plan(
    now: i64,
    list: &[Torrent],
    recs: &HashMap<String, PolicyRec>,
    d: &DownloadSettings,
    caps: &Capabilities,
) -> (Vec<Action>, HashMap<String, PolicyRec>) {
    let server = |k: &str| caps.via(k) == Some(Via::Server);
    let mut actions = Vec::new();
    let mut out: HashMap<String, PolicyRec> = HashMap::new();
    let rec_of = |out: &HashMap<String, PolicyRec>, id: &str| {
        out.get(id)
            .or_else(|| recs.get(id))
            .cloned()
            .unwrap_or_default()
    };

    for t in list {
        let mut rec = rec_of(&out, &t.id);
        if done(t) {
            rec.seeding_since.get_or_insert(now);
        } else {
            rec.seeding_since = None;
            rec.seed_limit_hit = false;
        }

        if server("moveCompleted")
            && d.move_completed_enabled
            && done(t)
            && !rec.moved
            && t.save_path != d.move_completed_path
        {
            actions.push(Action::Relocate(t.id.clone(), d.move_completed_path.clone()));
            rec.moved = true;
        }

        let seeded_mins = rec.seeding_since.map_or(0, |s| (now - s).max(0) / 60);
        let ratio_hit = server("seedLimits")
            && d.min_ratio > 0.0
            && t.ratio.is_some_and(|r| r >= d.min_ratio);
        let time_hit = d.min_seeding_minutes > 0 && seeded_mins >= i64::from(d.min_seeding_minutes);
        if t.status == Status::Seeding
            && !rec.seed_limit_hit
            && (!d.seed_automatically || ratio_hit || time_hit)
        {
            actions.push(Action::Pause(t.id.clone()));
            rec.paused_by = Some(PausedBy::Seeding);
            rec.seed_limit_hit = true;
        }
        if rec != rec_of(&HashMap::new(), &t.id) {
            out.insert(t.id.clone(), rec);
        }
    }

    if server("queue") {
        let limit = |n: u32| if n == 0 { usize::MAX } else { n as usize };
        let (max_dl, max_all) = (limit(d.max_active_downloads), limit(d.max_active_torrents));
        let paused_now = |id: &str| {
            actions
                .iter()
                .any(|a| matches!(a, Action::Pause(p) if p == id))
        };
        let seeding = list
            .iter()
            .filter(|t| t.status == Status::Seeding && !paused_now(&t.id))
            .count();
        let mut candidates: Vec<&Torrent> = list
            .iter()
            .filter(|t| {
                !done(t)
                    && (t.status == Status::Downloading
                        || rec_of(&out, &t.id).paused_by == Some(PausedBy::Queue))
            })
            .collect();
        candidates.sort_by_key(|t| (t.added_at, t.id.clone()));
        let mut running = 0;
        let mut queue_actions = Vec::new();
        for t in candidates {
            let mut rec = rec_of(&out, &t.id);
            let queued = rec.paused_by == Some(PausedBy::Queue);
            if running < max_dl && running + seeding < max_all {
                running += 1;
                if queued {
                    queue_actions.push(Action::Resume(t.id.clone()));
                    rec.paused_by = None;
                }
            } else if !queued {
                queue_actions.push(Action::Pause(t.id.clone()));
                rec.paused_by = Some(PausedBy::Queue);
            }
            if rec != rec_of(&HashMap::new(), &t.id) {
                out.insert(t.id.clone(), rec);
            }
        }
        actions.extend(queue_actions);
    }
    (actions, out)
}

pub async fn run(state: Arc<AppState>) {
    let mut prev: Option<HashMap<String, f64>> = None;
    let mut interval = tokio::time::interval(TICK);
    loop {
        interval.tick().await;
        let Ok(engine) = crate::api::engine(&state).await else {
            prev = None;
            continue;
        };
        let Ok(list) = engine.list().await else { continue };
        for ev in events(prev.as_ref(), &list) {
            let _ = state.events.send(ev);
        }
        prev = Some(list.iter().map(|t| (t.id.clone(), t.progress)).collect());

        let caps = engine.capabilities().await;
        let d = state.config.read().await.downloads.clone();
        let recs = list
            .iter()
            .map(|t| (t.id.clone(), state.store.policy(&t.id)))
            .collect();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_secs() as i64);
        let (actions, changed) = plan(now, &list, &recs, &d, &caps);
        for a in actions {
            let r = match &a {
                Action::Pause(id) => engine.pause(id).await,
                Action::Resume(id) => engine.resume(id).await,
                Action::Relocate(id, path) => engine.relocate(id, path).await,
            };
            if let Err(e) = r {
                tracing::warn!("policy {a:?} failed: {e}");
            }
        }
        for (id, rec) in changed {
            if let Err(e) = state.store.set_policy(&id, rec) {
                tracing::warn!("{e}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use torrentx_core::Priority;

    fn t(id: &str, status: Status, progress: f64, added_at: i64) -> Torrent {
        Torrent {
            id: id.into(),
            name: id.into(),
            size: 100,
            progress,
            download_rate: 0,
            upload_rate: 0,
            peers: 0,
            seeds: 0,
            status,
            error: None,
            eta_secs: None,
            added_at,
            save_path: "/dl".into(),
            downloaded: 100,
            uploaded: 0,
            ratio: Some(0.0),
            wanted_size: 100,
            tab_id: None,
            priority: Priority::Normal,
        }
    }

    fn server_caps() -> Capabilities {
        Capabilities::new("rqbit").server(&["queue", "seedLimits", "moveCompleted"])
    }

    #[test]
    fn queue_limit_pauses_newest_and_resumes_later() {
        let d = DownloadSettings {
            max_active_downloads: 2,
            ..Default::default()
        };
        let list = vec![
            t("a", Status::Downloading, 0.1, 1),
            t("b", Status::Downloading, 0.1, 2),
            t("c", Status::Downloading, 0.1, 3),
        ];
        let (actions, recs) = plan(0, &list, &HashMap::new(), &d, &server_caps());
        assert_eq!(actions, vec![Action::Pause("c".into())]);
        assert_eq!(recs["c"].paused_by, Some(PausedBy::Queue));

        // "a" completes → "c" (paused by queue) gets its slot back.
        let list = vec![
            t("a", Status::Seeding, 1.0, 1),
            t("b", Status::Downloading, 0.5, 2),
            t("c", Status::Paused, 0.1, 3),
        ];
        let (actions, recs) = plan(10, &list, &recs, &d, &server_caps());
        assert_eq!(actions, vec![Action::Resume("c".into())]);
        assert_eq!(recs["c"].paused_by, None);

        // A user-paused torrent is never resumed by the queue.
        let list = vec![t("u", Status::Paused, 0.1, 1)];
        let (actions, _) = plan(0, &list, &HashMap::new(), &d, &server_caps());
        assert!(actions.is_empty());
    }

    #[test]
    fn native_queue_is_left_to_the_engine() {
        let d = DownloadSettings {
            max_active_downloads: 1,
            ..Default::default()
        };
        let caps = Capabilities::new("transmission").engine(&["queue"]);
        let list = vec![
            t("a", Status::Downloading, 0.1, 1),
            t("b", Status::Downloading, 0.1, 2),
        ];
        assert!(plan(0, &list, &HashMap::new(), &d, &caps).0.is_empty());
    }

    #[test]
    fn ratio_and_seed_time_limits_stop_once() {
        let d = DownloadSettings {
            min_ratio: 1.0,
            min_seeding_minutes: 60,
            ..Default::default()
        };
        let mut s = t("s", Status::Seeding, 1.0, 1);
        s.ratio = Some(0.5);
        let (actions, recs) = plan(1000, &[s.clone()], &HashMap::new(), &d, &server_caps());
        assert!(actions.is_empty());
        assert_eq!(recs["s"].seeding_since, Some(1000));

        // Seeding time reached (fake clock +60 min).
        let (actions, recs) = plan(1000 + 3600, &[s.clone()], &recs, &d, &server_caps());
        assert_eq!(actions, vec![Action::Pause("s".into())]);
        assert!(recs["s"].seed_limit_hit);

        // The user resumes it: not paused again.
        let (actions, _) = plan(1000 + 7200, &[s.clone()], &recs, &d, &server_caps());
        assert!(actions.is_empty());

        // Ratio alone triggers too.
        s.ratio = Some(1.0);
        let (actions, _) = plan(0, &[s], &HashMap::new(), &d, &server_caps());
        assert_eq!(actions, vec![Action::Pause("s".into())]);
    }

    #[test]
    fn seed_automatically_off_and_move_completed() {
        let d = DownloadSettings {
            seed_automatically: false,
            move_completed_enabled: true,
            move_completed_path: "/done".into(),
            ..Default::default()
        };
        let list = vec![t("s", Status::Seeding, 1.0, 1)];
        let (actions, recs) = plan(0, &list, &HashMap::new(), &d, &server_caps());
        assert_eq!(
            actions,
            vec![
                Action::Relocate("s".into(), "/done".into()),
                Action::Pause("s".into())
            ]
        );
        let (actions, _) = plan(5, &list, &recs, &d, &server_caps());
        assert!(actions.is_empty(), "moved and stopped only once");
    }

    #[test]
    fn events_between_polls() {
        let list = vec![t("a", Status::Seeding, 1.0, 1), t("b", Status::Downloading, 0.2, 2)];
        assert!(events(None, &list).is_empty());
        let prev: HashMap<String, f64> = [("a".to_string(), 0.9)].into();
        assert_eq!(
            events(Some(&prev), &list),
            vec![
                ServerEvent::TorrentCompleted {
                    id: "a".into(),
                    name: "a".into()
                },
                ServerEvent::TorrentAdded {
                    id: "b".into(),
                    name: "b".into()
                },
            ]
        );
    }
}
