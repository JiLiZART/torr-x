---
default: minor
---

# Settings is a page

Settings now open as a page with its own address (`#/settings/<section>`) instead of a modal with a Save button.
A section rail covers General, Engine, Network, Bandwidth, Queue & seeding, Folders, Tabs & query, Terminal &
security, Notifications, Appearance and About, and "Search settings" (⌘F) finds any row. Ordinary changes save as
you make them, row by row. Changes that restart the engine wait behind a "Restart required" notice. Access and login
changes wait for Apply. Unsupported options stay visible with "not supported by <engine>". The Network section adds a
port reachability test, a random port button, the DHT node count and a protocol encryption setting. Pasting a
`tx://settings/<section>` link into Spotlight opens that section.
