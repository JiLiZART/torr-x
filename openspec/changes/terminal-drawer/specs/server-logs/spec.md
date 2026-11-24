## Purpose

Recent server log entries kept in memory and exposed over the HTTP API, so the UI can show what the engine,
trackers and the policy loop are doing without access to the host's journal.

## ADDED Requirements

### Requirement: Log buffer
The server SHALL keep its most recent log entries in memory — at least the last 2,000 — each with a strictly
increasing sequence number, a timestamp, a level (`error`, `warn`, `info`, `debug`), the component that emitted
it and a message. Older entries SHALL be discarded; the buffer SHALL NOT be written to disk and SHALL start empty
on every server start. Tracker failures, engine errors and decisions of the policy loop (queueing, seeding
limits, move-completed) SHALL produce entries. Entries SHALL NOT contain passwords, session tokens, or the
private part of tracker announce URLs.

#### Scenario: Policy decision is logged
- **WHEN** the policy loop holds a torrent back because the queue limit is reached
- **THEN** an entry saying so is in the buffer

#### Scenario: Bounded
- **WHEN** more entries are produced than the buffer holds
- **THEN** the oldest are dropped and the newest remain

#### Scenario: Secrets are not logged
- **WHEN** an announce to `https://tracker.example/<passkey>/announce` fails
- **THEN** the entry names the tracker host and does not contain the passkey

### Requirement: Logs endpoint
`GET /api/v1/logs` SHALL return `{"entries": [{seq, time, level, target, message}], "last": <seq>}` in ascending
sequence order. `after=<seq>` SHALL restrict the result to entries newer than that sequence number and
`limit=<n>` SHALL cap it (default 500, maximum 2,000), keeping the newest. The endpoint SHALL be subject to the
same authentication, Host and Origin rules as every other endpoint.

#### Scenario: Tail
- **WHEN** a client that last saw sequence 120 requests `/api/v1/logs?after=120`
- **THEN** only entries with a higher sequence number are returned, oldest first, with `last` set to the newest

#### Scenario: Nothing new
- **WHEN** no entry is newer than `after`
- **THEN** the response has an empty `entries` array and `last` unchanged

#### Scenario: Auth applies
- **WHEN** auth is enabled and an unauthenticated client requests `/api/v1/logs`
- **THEN** the response is 401 `unauthorized`
