## Purpose

Session transfer totals and host resource readings shown in the status bar and terminal, measured on the machine running the server.

## ADDED Requirements

### Requirement: Stats endpoint
`GET /api/v1/stats` SHALL return `downloadRate`, `uploadRate` (sum over torrents), `downloaded`, `uploaded` (session totals), `ratio` (uploaded / downloaded, null when downloaded is 0), `torrents`, `active` (downloading or seeding with nonzero rate), `diskFree` and `diskTotal` (bytes, for the filesystem holding the default save path), `cpuPercent` and `memoryBytes` of the server process. CPU SHALL be averaged over the interval since the previous sample (≥ 1 s).

#### Scenario: Engine down
- **WHEN** the engine is unavailable
- **THEN** stats still return disk, CPU and memory values, with torrent fields 0 and ratio null

#### Scenario: Disk free
- **WHEN** the default save path is on a volume with 10 GB free
- **THEN** `diskFree` is within 1% of 10 GB
