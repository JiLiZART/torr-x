import { Fragment, useEffect, useState, useRef } from "react";
import {
  X,
  Info,
  Link,
  Upload,
  Magnet,
  FolderOpen,
  Download,
  FileText,
  Square,
  CheckSquare,
  HardDrive,
  Calendar,
  Hash,
  ChevronDown,
  ChevronRight,
  FileIcon,
  Plus,
  ArrowLeft,
  Save,
} from "lucide-react";
import { DownloadOptionsForm, DownloadOptions } from "./DownloadOptionsForm";

// Types and Interfaces
type AddTorrentTab = "url" | "file" | "magnet";

interface AddTorrentProps {
  onClose: () => void;
}

interface FileItem {
  id: string;
  name: string;
  size: string;
  path?: string;
  isFolder?: boolean;
  children?: FileItem[];
  selected?: boolean;
  expanded?: boolean;
}

interface TorrentInfo {
  name: string;
  size: string;
  files: number;
  dateCreated: string;
  comment: string;
  hash: string;
  trackers: string[];
  pieceSize: string;
  pieces: number;
}

interface FileTreeProps {
  files: FileItem[];
  onToggleFolder: (fileId: string) => void;
  onToggleSelection: (fileId: string) => void;
  onSelectAll: (select: boolean) => void;
}

interface TorrentInfoSidebarProps {
  torrentInfo: TorrentInfo;
  onClose: () => void;
}

interface AddTorrentFormProps {
  activeTab: AddTorrentTab;
  onTabChange: (tab: AddTorrentTab) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string;
  url: string;
  onUrlChange: (url: string) => void;
  magnetLink: string;
  onMagnetChange: (magnet: string) => void;
  fileName: string;
  onFileSelect: (file: File) => void;
}
export function AddTorrent({ onClose }: AddTorrentProps) {
  const [activeTab, setActiveTab] = useState<AddTorrentTab>("url");
  const [url, setUrl] = useState("");
  const [magnetLink, setMagnetLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    downloadPath: "D:\\Downloads\\Torrents",
    createSubfolder: true,
    startTorrent: true,
    priority: "normal",
  } as DownloadOptions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showFileSelection, setShowFileSelection] = useState(false);
  const [filesTree, setFilesTree] = useState<FileItem[]>([]);
  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | null>(null);
  const [showTorrentInfo, setShowTorrentInfo] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load torrent info when entering file selection screen
  useEffect(() => {
    if (showFileSelection) {
      // TODO: Add getTorrentInfo API call when available
      setTorrentInfo({
        name: fileName || url || "Unknown Torrent",
        size: "0 B",
        files: 0,
        dateCreated: new Date().toISOString(),
        comment: "",
        hash: "",
        trackers: [],
        pieceSize: "0 B",
        pieces: 0,
      });
      // Mock file tree
      const mockFilesTree: FileItem[] = [
        {
          id: "1",
          name: "ubuntu-22.04-desktop-amd64.iso",
          size: "3.8 GB",
          selected: true,
          path: "/ubuntu-22.04-desktop-amd64.iso",
        },
        {
          id: "2",
          name: "docs",
          size: "57 KB",
          isFolder: true,
          expanded: true,
          selected: true,
          path: "/docs",
          children: [
            {
              id: "2-1",
              name: "README.md",
              size: "12 KB",
              selected: true,
              path: "/docs/README.md",
            },
            {
              id: "2-2",
              name: "release-notes.txt",
              size: "45 KB",
              selected: true,
              path: "/docs/release-notes.txt",
            },
          ],
        },
        {
          id: "3",
          name: "extras",
          size: "250 MB",
          isFolder: true,
          expanded: false,
          selected: true,
          path: "/extras",
          children: [
            {
              id: "3-1",
              name: "wallpapers",
              size: "250 MB",
              isFolder: true,
              expanded: false,
              selected: true,
              path: "/extras/wallpapers",
              children: [
                {
                  id: "3-1-1",
                  name: "ubuntu-default.png",
                  size: "2.4 MB",
                  selected: true,
                  path: "/extras/wallpapers/ubuntu-default.png",
                },
                {
                  id: "3-1-2",
                  name: "ubuntu-dark.png",
                  size: "2.1 MB",
                  selected: true,
                  path: "/extras/wallpapers/ubuntu-dark.png",
                },
                {
                  id: "3-1-3",
                  name: "ubuntu-light.png",
                  size: "1.9 MB",
                  selected: true,
                  path: "/extras/wallpapers/ubuntu-light.png",
                },
              ],
            },
          ],
        },
        {
          id: "4",
          name: "ubuntu-22.04-desktop-amd64.iso.md5",
          size: "128 B",
          selected: true,
          path: "/ubuntu-22.04-desktop-amd64.iso.md5",
        },
      ];
      setFilesTree(mockFilesTree);
    }
  }, [showFileSelection, fileName, url]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    }
  };
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  const handleSubmit = () => {
    setError("");
    // Validate based on active tab
    if (activeTab === "url" && !url) {
      setError("Please enter a valid URL");
      return;
    }
    if (activeTab === "file" && !fileName) {
      setError("Please select a torrent file");
      return;
    }
    if (activeTab === "magnet" && !magnetLink) {
      setError("Please enter a valid magnet link");
      return;
    }
    // Simulate adding the torrent
    setIsSubmitting(true);
    // Mock API call
    setTimeout(() => {
      setIsSubmitting(false);
      // Instead of closing, show file selection modal
      setShowFileSelection(true);
    }, 1000);
  };

  const toggleFolder = (fileId: string) => {
    const toggleExpanded = (items: FileItem[]): FileItem[] => {
      return items.map((item) => {
        if (item.id === fileId) {
          return {
            ...item,
            expanded: !item.expanded,
          };
        }
        if (item.children) {
          return {
            ...item,
            children: toggleExpanded(item.children),
          };
        }
        return item;
      });
    };
    setFilesTree(toggleExpanded(filesTree));
  };

  const toggleFileSelection = (fileId: string) => {
    const toggleSelected = (items: FileItem[]): FileItem[] => {
      return items.map((item) => {
        if (item.id === fileId) {
          // Toggle the selected state
          const newSelectedState = !item.selected;
          // If it's a folder, also update all children
          if (item.isFolder && item.children) {
            return {
              ...item,
              selected: newSelectedState,
              children: updateChildrenSelection(
                item.children,
                newSelectedState
              ),
            };
          }
          return {
            ...item,
            selected: newSelectedState,
          };
        }
        if (item.children) {
          return {
            ...item,
            children: toggleSelected(item.children),
          };
        }
        return item;
      });
    };
    setFilesTree(toggleSelected(filesTree));
  };

  // Helper function to recursively update all children selection state
  const updateChildrenSelection = (
    items: FileItem[],
    selected: boolean
  ): FileItem[] => {
    return items.map((item) => {
      if (item.children) {
        return {
          ...item,
          selected,
          children: updateChildrenSelection(item.children, selected),
        };
      }
      return {
        ...item,
        selected,
      };
    });
  };

  const selectAllFiles = (select: boolean) => {
    const updateSelection = (items: FileItem[]): FileItem[] => {
      return items.map((item) => {
        if (item.children) {
          return {
            ...item,
            selected: select,
            children: updateSelection(item.children),
          };
        }
        return {
          ...item,
          selected: select,
        };
      });
    };
    setFilesTree(updateSelection(filesTree));
  };

  const finalizeDownload = () => {
    // In a real app, you would process the selected files and start the download
    // Here we just close the modal
    onClose();
  };

  const TorrentInfoSidebar: React.FC<TorrentInfoSidebarProps> = ({
    torrentInfo,
    onClose,
  }) => {
    const renderDetailItem = (
      icon: React.ReactNode,
      label: string,
      value: string | number
    ) => (
      <div className="flex items-start space-x-3 py-2">
        <div className="text-green-600 mt-0.5">{icon}</div>
        <div>
          <div className="text-green-700 text-xs">{label}</div>
          <div className="text-green-400 text-sm">{value}</div>
        </div>
      </div>
    );

    return (
      <div className="w-72 bg-black/30 overflow-y-auto p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider">
            Torrent Information
          </h3>
          <button
            onClick={onClose}
            className="text-green-500 hover:text-green-400"
          >
            <X size={14} />
          </button>
        </div>

        {renderDetailItem(<FileText size={14} />, "Name", torrentInfo.name)}
        {renderDetailItem(<FileText size={14} />, "Size", torrentInfo.size)}
        {renderDetailItem(<FileText size={14} />, "Files", torrentInfo.files)}
        {renderDetailItem(
          <Calendar size={14} />,
          "Created",
          torrentInfo.dateCreated
        )}
        {renderDetailItem(<Hash size={14} />, "Hash", torrentInfo.hash)}
        {renderDetailItem(
          <FileText size={14} />,
          "Comment",
          torrentInfo.comment
        )}

        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-4 mb-2">
          Trackers
        </h4>
        <div className="text-xs text-green-400 space-y-1 border border-green-900/30 rounded p-2 bg-black/30 max-h-28 overflow-y-auto">
          {torrentInfo.trackers.map((tracker, index) => (
            <div key={index} className="break-all">
              {tracker}
            </div>
          ))}
        </div>

        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-4 mb-2">
          Technical Details
        </h4>
        {renderDetailItem(
          <FileText size={14} />,
          "Piece Size",
          torrentInfo.pieceSize
        )}
        {renderDetailItem(<FileText size={14} />, "Pieces", torrentInfo.pieces)}
      </div>
    );
  };
  const FileTreeView: React.FC<FileTreeProps> = ({
    files,
    onToggleFolder,
    onToggleSelection,
    onSelectAll,
  }) => {
    const renderFileTree = (items: FileItem[], level = 0) => {
      return items.map((file) => {
        const indentation = level * 16;
        const isFolder = file.isFolder || false;
        const isExpanded = file.expanded || false;
        const isSelected = file.selected || false;

        return (
          <Fragment key={file.id}>
            <tr className="hover:bg-green-900/10">
              <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                <div
                  className="flex items-center"
                  style={{ paddingLeft: `${indentation}px` }}
                >
                  <button
                    className="mr-2 focus:outline-none text-green-500 hover:text-green-300"
                    onClick={() => onToggleSelection(file.id)}
                  >
                    {isSelected ? (
                      <CheckSquare size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                  {isFolder ? (
                    <button
                      className="mr-1 focus:outline-none text-green-600 hover:text-green-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFolder(file.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                  ) : (
                    <span className="ml-4" />
                  )}
                  <span className="mr-2">
                    {isFolder ? (
                      <span className="text-yellow-500">📁</span>
                    ) : (
                      <FileIcon size={14} />
                    )}
                  </span>
                  {file.name}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                {file.size}
              </td>
            </tr>
            {isFolder &&
              isExpanded &&
              file.children &&
              renderFileTree(file.children, level + 1)}
          </Fragment>
        );
      });
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-green-900/30 bg-black/30 flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => onSelectAll(true)}
              className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-2 rounded-md transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => onSelectAll(false)}
              className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-2 rounded-md transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="min-w-full divide-y divide-green-900/30">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                  Size
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-900/20">
              {renderFileTree(files)}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (showFileSelection) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-950 border border-green-900/50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-green-900/30">
            <h2 className="text-green-400 font-semibold flex items-center">
              <Download size={16} className="mr-2" />
              Select Files to Download
            </h2>
            <button
              onClick={onClose}
              className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {/* File selection area */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-green-900/30">
              <div className="p-3 border-b border-green-900/30 bg-black/30 flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={() => selectAllFiles(true)}
                    className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-2 rounded-md transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => selectAllFiles(false)}
                    className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-2 rounded-md transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
                <button
                  onClick={() => setShowTorrentInfo(!showTorrentInfo)}
                  className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-2 rounded-md transition-colors flex items-center"
                >
                  <Info size={12} className="mr-1.5" />
                  {showTorrentInfo ? "Hide Info" : "Show Info"}
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full divide-y divide-green-900/30">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Size
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-900/20">
                    {renderFileTree(filesTree)}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Torrent info sidebar */}
            {showTorrentInfo && torrentInfo && (
              <div className="w-72 bg-black/30 overflow-y-auto p-4">
                <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
                  Torrent Information
                </h3>
                {renderDetailItem(
                  <FileText size={14} />,
                  "Name",
                  torrentInfo.name
                )}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Size",
                  torrentInfo.size
                )}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Files",
                  torrentInfo.files
                )}
                {renderDetailItem(
                  <Calendar size={14} />,
                  "Created",
                  torrentInfo.dateCreated
                )}
                {renderDetailItem(<Hash size={14} />, "Hash", torrentInfo.hash)}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Comment",
                  torrentInfo.comment
                )}
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-4 mb-2">
                  Trackers
                </h4>
                <div className="text-xs text-green-400 space-y-1 border border-green-900/30 rounded p-2 bg-black/30 max-h-28 overflow-y-auto">
                  {torrentInfo.trackers.map((tracker, index) => (
                    <div key={index} className="break-all">
                      {tracker}
                    </div>
                  ))}
                </div>
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-4 mb-2">
                  Technical Details
                </h4>
                {renderDetailItem(
                  <FileText size={14} />,
                  "Piece Size",
                  torrentInfo.pieceSize
                )}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Pieces",
                  torrentInfo.pieces
                )}
              </div>
            )}
          </div>
          <div className="border-t border-green-900/30 p-4 bg-black/30">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-green-400">Save to:</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={downloadOptions.downloadPath}
                  onChange={(e) =>
                    setDownloadOptions((prev: DownloadOptions) => ({
                      ...prev,
                      downloadPath: e.target.value,
                    }))
                  }
                  className="bg-gray-900 border border-green-900/50 rounded-l px-3 py-1.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700"
                />
                <button className="bg-green-900/50 hover:bg-green-900/70 text-green-400 py-1.5 px-3 rounded-r border border-green-900/50 transition-colors">
                  <FolderOpen size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-green-700 flex items-center">
                <HardDrive size={12} className="mr-1.5" />
                Disk space required: 3.8 GB / available: 1.85 TB
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowFileSelection(false)}
                  className="flex items-center text-xs bg-gray-800 hover:bg-gray-700 text-green-400 py-1.5 px-4 rounded-md transition-colors"
                >
                  <ArrowLeft size={12} className="mr-1.5" />
                  Back
                </button>
                <button
                  onClick={finalizeDownload}
                  className="flex items-center text-xs bg-green-800 hover:bg-green-700 text-green-100 py-1.5 px-4 rounded-md transition-colors"
                >
                  <Save size={12} className="mr-1.5" />
                  Start Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-green-900/50 rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex justify-between items-center p-4 border-b border-green-900/30">
          <h2 className="text-green-400 font-semibold flex items-center">
            <Plus size={16} className="mr-2" />
            Add New Torrent
          </h2>
          <button
            onClick={onClose}
            className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <div className="flex border-b border-green-900/30 mb-4">
            <button
              onClick={() => setActiveTab("url")}
              className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "url"
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-green-600 hover:text-green-500 hover:border-green-700"
              }`}
            >
              <Link size={14} className="mr-2" />
              URL
            </button>
            <button
              onClick={() => setActiveTab("file")}
              className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "file"
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-green-600 hover:text-green-500 hover:border-green-700"
              }`}
            >
              <Upload size={14} className="mr-2" />
              Torrent File
            </button>
            <button
              onClick={() => setActiveTab("magnet")}
              className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "magnet"
                  ? "border-green-500 text-green-400"
                  : "border-transparent text-green-600 hover:text-green-500 hover:border-green-700"
              }`}
            >
              <Magnet size={14} className="mr-2" />
              Magnet Link
            </button>
          </div>
          {activeTab === "url" && (
            <div className="mb-4">
              <label className="block text-sm text-green-400 mb-1">
                Torrent URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.torrent"
                className="w-full bg-gray-900 border border-green-900/50 rounded px-3 py-2 text-sm text-green-400 placeholder-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
              />
              <p className="text-xs text-green-700 mt-1">
                Enter the URL of a .torrent file to download
              </p>
            </div>
          )}
          {activeTab === "file" && (
            <div className="mb-4">
              <label className="block text-sm text-green-400 mb-1">
                Upload Torrent File
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={fileName}
                  readOnly
                  placeholder="No file selected"
                  className="flex-1 bg-gray-900 border border-green-900/50 rounded-l px-3 py-2 text-sm text-green-400 placeholder-green-700 focus:outline-none"
                />
                <button
                  onClick={triggerFileInput}
                  className="bg-green-900/50 hover:bg-green-900/70 text-green-400 py-2 px-4 rounded-r border border-green-900/50 transition-colors"
                >
                  Browse
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".torrent"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-green-700 mt-1">
                Select a .torrent file from your device
              </p>
            </div>
          )}
          {activeTab === "magnet" && (
            <div className="mb-4">
              <label className="block text-sm text-green-400 mb-1">
                Magnet Link
              </label>
              <textarea
                value={magnetLink}
                onChange={(e) => setMagnetLink(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows={3}
                className="w-full bg-gray-900 border border-green-900/50 rounded px-3 py-2 text-sm text-green-400 placeholder-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
              />
              <p className="text-xs text-green-700 mt-1">
                Paste a magnet link to download
              </p>
            </div>
          )}

          <DownloadOptionsForm
            options={downloadOptions}
            onOptionsChange={(updates: Partial<DownloadOptions>) =>
              setDownloadOptions((prev) => ({ ...prev, ...updates }))
            }
          />

          {error && (
            <div className="mt-4 bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
        <div className="border-t border-green-900/30 p-4 bg-black/30 flex items-center justify-between">
          <div className="text-xs text-green-700">
            <span className="flex items-center">
              <HardDrive size={12} className="mr-1.5" />
              Disk space available: 1.85 TB
            </span>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-green-400 py-1.5 px-4 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center text-xs bg-green-800 hover:bg-green-700 text-green-100 py-1.5 px-4 rounded-md transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-100"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <Download size={12} className="mr-1.5" />
                  Add Torrent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
