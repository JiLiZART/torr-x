import { Disc3, File, FileArchive, FileCode, FileCog, FileImage, FileMusic, FileSpreadsheet, FileTerminal, FileText, FileType, FileVideo, Captions, BookOpen, type LucideIcon } from "lucide-react";
import { fileKind, type FileKind } from "../../lib/detail";

const ICONS: Record<FileKind, [LucideIcon, string]> = {
  video: [FileVideo, "text-ui-cyan"],
  audio: [FileMusic, "text-ui-violet"],
  image: [FileImage, "text-ui-amber"],
  subtitle: [Captions, "text-ui-text-2"],
  text: [FileText, "text-ui-text-2"],
  document: [BookOpen, "text-ui-red"],
  sheet: [FileSpreadsheet, "text-ui-accent"],
  code: [FileCode, "text-ui-cyan"],
  data: [FileCog, "text-ui-text-3"],
  archive: [FileArchive, "text-ui-amber"],
  disc: [Disc3, "text-ui-violet"],
  font: [FileType, "text-ui-text-2"],
  executable: [FileTerminal, "text-ui-red"],
  other: [File, "text-ui-text-3"],
};

/** A file's icon by its extension, like a file manager shows it. */
export function FileIcon({ ext, size = 13 }: { ext: string; size?: number }) {
  const [Icon, tone] = ICONS[fileKind(ext)];
  return <Icon size={size} className={`shrink-0 ${tone}`} />;
}
