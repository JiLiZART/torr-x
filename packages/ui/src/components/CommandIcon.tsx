import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePause,
  CirclePlay,
  Download,
  Edit3,
  FilePlus,
  FolderInput,
  FolderOpen,
  Funnel,
  FunnelX,
  Hash,
  Keyboard,
  Layers,
  Link2,
  ListChecks,
  ListFilter,
  LogOut,
  PanelBottomOpen,
  PanelLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Rows3,
  Save,
  Search,
  Settings,
  SquareTerminal,
  Tag,
  Trash,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

// Explicit imports keep the bundle to the icons the registry names.
const ICONS: Record<string, LucideIcon> = { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CirclePause, CirclePlay, Download, Edit3, FilePlus, FolderInput, FolderOpen, Funnel, FunnelX, Hash, Keyboard, Layers, Link2, ListChecks, ListFilter, LogOut, PanelBottomOpen, PanelLeft, Pause, Pencil, Play, Plus, Rows3, Save, Search, Settings, SquareTerminal, Tag, Trash, Trash2, Undo2, X };

/** A registry icon by name (`CommandDef.icon`). */
export function CommandIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Hash;
  return <Icon {...props} />;
}
