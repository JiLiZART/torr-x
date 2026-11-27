import { useState, type ReactNode } from "react";
import { api, type FileInfo, type TorrentDetails } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { bytes } from "../../lib/format";
import { extOf, fileActionBlock } from "../../lib/detail";
import { headNeed, INLINE_EXT } from "../../lib/media";
import { Player } from "./Player";

/** The browser runs on the machine that runs TorrentX: open / reveal can work. */
export const isLocal = () => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname) || "__TAURI_INTERNALS__" in window;

interface Playback {
  /** Why Play cannot run for this file, or undefined when it can. */
  hint: (file: FileInfo) => string | undefined;
  play: (file: FileInfo) => void;
  /** The player overlay while a file plays, else null. */
  overlay: ReactNode;
}

/**
 * Play for the hero, the episode rows and the file actions. Files a browser can decode (`INLINE_EXT`) play in the
 * built-in player on the stream link; the rest open in the machine's video player, or, from another device, copy
 * the link for one.
 */
export function usePlayback(d: TorrentDetails | null | undefined, onNotice: (message: string) => void, onError: (e: unknown) => void): Playback {
  const { t, gate, caps } = useUi();
  const [playing, setPlaying] = useState<{ file: FileInfo; path: string } | null>(null);
  const local = isLocal();
  const stream = gate("stream");

  const hint = (file: FileInfo) => {
    const need = headNeed(file);
    const why = fileActionBlock("play", { openFile: gate("openFile"), stream, local, done: file.progress >= 1, need });
    if (!why) return undefined;
    if (why === "engine") return t("caps.notSupported", { engine: caps?.engine ?? "" });
    return why === "notReady" ? t("detail.block.notReady", { size: bytes(need) }) : t(`detail.block.${why}`);
  };
  const external = (file: FileInfo) => {
    if (local) api.playFile(d!.id, file.index).then((r) => onNotice(t(r.streaming ? "detail.streaming" : "detail.playing")), onError);
    else copyLink(file);
  };
  const copyLink = (file: FileInfo) =>
    // Another device: hand over a link to paste into a player there.
    api
      .streamFile(d!.id, file.index)
      .then((path) => navigator.clipboard.writeText(`${location.origin}${path}`))
      .then(() => onNotice(t("detail.streamCopied")), onError);
  const play = (file: FileInfo) => {
    if (!d) return;
    if (!stream && INLINE_EXT.has(extOf(file.path))) {
      api.streamFile(d.id, file.index).then((path) => setPlaying({ file, path }), onError);
    } else external(file);
  };

  const overlay = playing && d && (
    <Player
      name={playing.file.path.split("/").pop() ?? playing.file.path}
      src={playing.path}
      local={local}
      onClose={() => setPlaying(null)}
      onCopy={() => copyLink(playing.file)}
      onExternal={() => {
        setPlaying(null);
        external(playing.file);
      }}
    />
  );
  return { hint, play, overlay };
}
