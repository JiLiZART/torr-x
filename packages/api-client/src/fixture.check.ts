// Compile-time guard against drift between the Rust model and these types:
// the fixture is also asserted by a serde round-trip test in torrentx-core.
import fixture from "../../../crates/torrentx-core/tests/fixtures/torrent.json";
import type { Status, TorrentDetails } from "./index";

type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

export const sameKeys: SameKeys<typeof fixture, TorrentDetails> = true;
export const typed: TorrentDetails = { ...fixture, status: fixture.status as Status };
