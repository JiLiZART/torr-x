import React, { useEffect, useState, Children, Fragment } from "react";
import {
  X,
  FileText,
  Link,
  Calendar,
  Clock,
  HardDrive,
  Hash,
  Download,
  Upload,
  Zap,
  Users,
  Share2,
  Globe,
  Server,
  FileIcon,
  Wifi,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  ChevronDown,
  FolderIcon,
  MoreVertical,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  User,
  RefreshCw,
} from "lucide-react";
import { peers, seeds, trackers } from "./mock_data";
interface TorrentDetailsProps {
  torrent: any;
  onClose: () => void;
}
interface TabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
}
interface FileItem {
  id: string;
  name: string;
  size: string;
  progress: number;
  priority: string;
  isFolder?: boolean;
  children?: FileItem[];
  level?: number;
  expanded?: boolean;
  path?: string;
}

// Generate mock piece status data (for GitHub-like graph)
const totalPieces = 200;
const downloadingPieces = Math.floor(totalPieces * 0.05); // 5% are currently downloading
const downloadedPieces = Math.floor(totalPieces * (80 / 100));

const mockPieceStatus = Array.from(
  {
    length: totalPieces,
  },
  (_, index) => {
    if (index < downloadedPieces) return "downloaded";
    if (index < downloadedPieces + downloadingPieces) return "downloading";
    return "empty";
  }
);
// Shuffle the array to make it look more realistic
// (in reality, pieces aren't downloaded sequentially)
for (let i = mockPieceStatus.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [mockPieceStatus[i], mockPieceStatus[j]] = [
    mockPieceStatus[j],
    mockPieceStatus[i],
  ];
}

// Generate file tree structure
const mockFilesTree: FileItem[] = [
  {
    id: "1",
    name: "ubuntu-22.04-desktop-amd64.iso",
    size: "3.8 GB",
    progress: 100,
    priority: "Normal",
    path: "/ubuntu-22.04-desktop-amd64.iso",
  },
  {
    id: "2",
    name: "docs",
    size: "57 KB",
    progress: 82,
    priority: "Normal",
    isFolder: true,
    expanded: true,
    path: "/docs",
    children: [
      {
        id: "2-1",
        name: "README.md",
        size: "12 KB",
        progress: 100,
        priority: "High",
        path: "/docs/README.md",
      },
      {
        id: "2-2",
        name: "release-notes.txt",
        size: "45 KB",
        progress: 75,
        priority: "Low",
        path: "/docs/release-notes.txt",
      },
    ],
  },
  {
    id: "3",
    name: "extras",
    size: "250 MB",
    progress: 32,
    priority: "Normal",
    isFolder: true,
    expanded: false,
    path: "/extras",
    children: [
      {
        id: "3-1",
        name: "wallpapers",
        size: "250 MB",
        progress: 32,
        priority: "Normal",
        isFolder: true,
        expanded: false,
        path: "/extras/wallpapers",
        children: [
          {
            id: "3-1-1",
            name: "ubuntu-default.png",
            size: "2.4 MB",
            progress: 100,
            priority: "Normal",
            path: "/extras/wallpapers/ubuntu-default.png",
          },
          {
            id: "3-1-2",
            name: "ubuntu-dark.png",
            size: "2.1 MB",
            progress: 100,
            priority: "Normal",
            path: "/extras/wallpapers/ubuntu-dark.png",
          },
          {
            id: "3-1-3",
            name: "ubuntu-light.png",
            size: "1.9 MB",
            progress: 0,
            priority: "Low",
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
    progress: 100,
    priority: "Normal",
    path: "/ubuntu-22.04-desktop-amd64.iso.md5",
  },
];

// Mock data for tabs
const tabs: TabProps[] = [
  {
    id: "general",
    label: "General",
    icon: <FileText size={14} />,
  },
  {
    id: "trackers",
    label: "Trackers",
    icon: <Globe size={14} />,
  },
  {
    id: "peers",
    label: "Peers",
    icon: <Users size={14} />,
  },
  {
    id: "seeds",
    label: "Seeds",
    icon: <Server size={14} />,
  },
  {
    id: "files",
    label: "Files",
    icon: <FileIcon size={14} />,
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "downloading":
      return "text-blue-500";
    case "seeding":
      return "text-green-500";
    case "paused":
      return "text-yellow-500";
    case "error":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
};

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

export function TorrentDetails({ torrent, onClose }: TorrentDetailsProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [downloadHistory, setDownloadHistory] = useState<number[]>([]);
  const [uploadHistory, setUploadHistory] = useState<number[]>([]);
  const [filesTree, setFilesTree] = useState<FileItem[]>([]);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  const [pieceStatus, setPieceStatus] = useState<
    Array<"downloaded" | "empty" | "downloading">
  >([]);
  // Generate mock data for the graph on component mount
  useEffect(() => {
    // Generate some mock data for download/upload history
    const mockDownloadHistory = Array.from(
      {
        length: 30,
      },
      () => Math.random() * torrent.downloadSpeed * 1.5
    );
    const mockUploadHistory = Array.from(
      {
        length: 30,
      },
      () => Math.random() * torrent.uploadSpeed * 1.5
    );
    setDownloadHistory(mockDownloadHistory);
    setUploadHistory(mockUploadHistory);

    setPieceStatus(
      mockPieceStatus as Array<"downloaded" | "empty" | "downloading">
    );
    // Simulate real-time updates
    const interval = setInterval(() => {
      setDownloadHistory((prev) => {
        const newValue = Math.max(
          0,
          prev[prev.length - 1] + (Math.random() - 0.5) * 2
        );
        return [...prev.slice(1), newValue];
      });
      setUploadHistory((prev) => {
        const newValue = Math.max(
          0,
          prev[prev.length - 1] + (Math.random() - 0.5) * 1
        );
        return [...prev.slice(1), newValue];
      });
    }, 1000);

    setFilesTree(mockFilesTree);
    return () => clearInterval(interval);
  }, [torrent.downloadSpeed, torrent.uploadSpeed]);

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

  // Function to render the GitHub-like pieces grid
  const renderPiecesGrid = () => {
    return (
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
          Pieces Status
        </h4>
        <div className="border border-green-900/30 rounded-md p-3 bg-black/20">
          <div className="h-[120px] w-full overflow-hidden relative">
            <div className="flex flex-wrap w-full h-full">
              {pieceStatus.map((status, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 m-0.5 rounded-sm ${
                    status === "downloaded"
                      ? "bg-green-500"
                      : status === "downloading"
                      ? "bg-blue-500"
                      : "bg-gray-800"
                  }`}
                  title={`Piece ${i + 1}: ${status}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between mt-3 text-xs text-green-600">
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-sm bg-green-500 mr-2"></div>
              <span>Downloaded</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-sm bg-blue-500 mr-2"></div>
              <span>Downloading</span>
            </div>
            <div className="flex items-center">
              <div className="h-3 w-3 rounded-sm bg-gray-800 mr-2"></div>
              <span>Not Downloaded</span>
            </div>
          </div>
        </div>
      </div>
    );
  };
  // Function to render the wave-line graph
  const renderGraph = () => {
    const maxDownload = Math.max(...downloadHistory, 1);
    const maxUpload = Math.max(...uploadHistory, 1);
    const height = 60;
    const width = 300;
    // Create points for the download line
    const downloadPoints = downloadHistory
      .map((value, index) => {
        const x = (index / (downloadHistory.length - 1)) * width;
        const y = height - (value / maxDownload) * height;
        return `${x},${y}`;
      })
      .join(" ");
    // Create points for the upload line
    const uploadPoints = uploadHistory
      .map((value, index) => {
        const x = (index / (uploadHistory.length - 1)) * width;
        const y = height - (value / maxUpload) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <div className="mt-4 p-4 border border-green-900/30 rounded-md bg-black/50">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <ArrowDownCircle size={14} className="text-blue-500 mr-1" />
            <span className="text-blue-500 text-xs font-semibold">
              Download: {torrent.downloadSpeed} MB/s
            </span>
          </div>
          <div className="flex items-center">
            <ArrowUpCircle size={14} className="text-green-500 mr-1" />
            <span className="text-green-500 text-xs font-semibold">
              Upload: {torrent.uploadSpeed} MB/s
            </span>
          </div>
        </div>
        <svg width={width} height={height} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={`grid-${i}`}
              x1="0"
              y1={(i * height) / 3}
              x2={width}
              y2={(i * height) / 3}
              stroke="#1f2937"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          ))}
          {/* Download line */}
          <polyline
            points={downloadPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
          {/* Upload line */}
          <polyline
            points={uploadPoints}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.5"
          />
        </svg>
        <div className="flex justify-between text-xs text-green-700 mt-1">
          <span>30s ago</span>
          <span>Now</span>
        </div>
      </div>
    );
  };
  // Recursive function to render file tree
  const renderFileTree = (files: FileItem[], level = 0) => {
    return files.map((file) => {
      const indentation = level * 16; // 16px per level
      const isFolder = file.isFolder || false;
      const isExpanded = file.expanded || false;
      const hasChildren = isFolder && file.children && file.children.length > 0;
      return (
        <Fragment key={file.id}>
          <tr
            className="hover:bg-green-900/10 relative"
            onMouseEnter={(e) => {
              setHoveredFileId(file.id);
              setMenuPosition({
                x: e.currentTarget.getBoundingClientRect().right - 100,
                y: e.currentTarget.getBoundingClientRect().top,
              });
            }}
            onMouseLeave={() => setHoveredFileId(null)}
          >
            <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
              <div
                className="flex items-center"
                style={{
                  paddingLeft: `${indentation}px`,
                }}
              >
                {isFolder ? (
                  <button
                    className="mr-1 focus:outline-none text-green-600 hover:text-green-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(file.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                ) : (
                  <span className="ml-4"></span>
                )}
                <span className="mr-2">
                  {isFolder ? (
                    <FolderIcon size={14} className="text-yellow-500" />
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
            <td className="px-3 py-2 whitespace-nowrap text-sm">
              <div className="w-24 bg-gray-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-green-600"
                  style={{
                    width: `${file.progress}%`,
                  }}
                ></div>
              </div>
              <span className="text-xs text-green-400">{file.progress}%</span>
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-sm">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  file.priority === "High"
                    ? "bg-blue-900/30 text-blue-400"
                    : file.priority === "Low"
                    ? "bg-yellow-900/30 text-yellow-400"
                    : "bg-green-900/30 text-green-400"
                }`}
              >
                {file.priority}
              </span>
            </td>
            {hoveredFileId === file.id && (
              <div
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-950 border border-green-900/30 rounded-md shadow-lg z-10"
                style={{
                  minWidth: "140px",
                }}
              >
                <ul className="py-1 text-xs">
                  <li>
                    <button className="px-3 py-1.5 w-full text-left hover:bg-green-900/20 flex items-center text-green-400">
                      <Download size={12} className="mr-2" />
                      {file.progress === 100
                        ? "Download Again"
                        : "Download Now"}
                    </button>
                  </li>
                  <li>
                    <button className="px-3 py-1.5 w-full text-left hover:bg-green-900/20 flex items-center text-green-400">
                      {file.progress > 0 ? (
                        <>
                          <XCircle size={12} className="mr-2" />
                          Skip File
                        </>
                      ) : (
                        <>
                          <CheckCircle size={12} className="mr-2" />
                          Include File
                        </>
                      )}
                    </button>
                  </li>
                  <li className="border-t border-green-900/20 pt-1 mt-1">
                    <button className="px-3 py-1.5 w-full text-left hover:bg-green-900/20 flex items-center text-green-400">
                      <ArrowUp size={12} className="mr-2" />
                      High Priority
                    </button>
                  </li>
                  <li>
                    <button className="px-3 py-1.5 w-full text-left hover:bg-green-900/20 flex items-center text-green-400">
                      <span className="ml-4 mr-2">-</span>
                      Normal Priority
                    </button>
                  </li>
                  <li>
                    <button className="px-3 py-1.5 w-full text-left hover:bg-green-900/20 flex items-center text-green-400">
                      <ArrowDown size={12} className="mr-2" />
                      Low Priority
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </tr>
          {/* Render children if folder is expanded */}
          {isFolder &&
            isExpanded &&
            file.children &&
            renderFileTree(file.children, level + 1)}
        </Fragment>
      );
    });
  };
  // Function to render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <>
            {renderGraph()}
            {renderPiecesGrid()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                  General Information
                </h4>
                {renderDetailItem(
                  <FileText size={14} />,
                  "Total Size",
                  torrent.size
                )}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Downloaded",
                  `${(
                    parseFloat(torrent.size) *
                    (torrent.progress / 100)
                  ).toFixed(2)} GB (${torrent.progress}%)`
                )}
                {renderDetailItem(<Users size={14} />, "Seeds", torrent.seeds)}
                {renderDetailItem(<Users size={14} />, "Peers", torrent.peers)}
                {renderDetailItem(
                  <Wifi size={14} />,
                  "Connections",
                  torrent.peers + Math.floor(torrent.seeds * 0.3)
                )}
                {renderDetailItem(
                  <User size={14} />,
                  "Created By",
                  torrent.createdBy || "Unknown"
                )}
                {renderDetailItem(
                  <Calendar size={14} />,
                  "Created Date",
                  torrent.dateCreated || "Unknown"
                )}
                {renderDetailItem(
                  <RefreshCw size={14} />,
                  "Last Updated",
                  "2 minutes ago"
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                  Technical Details
                </h4>
                {renderDetailItem(
                  <HardDrive size={14} />,
                  "Save Path",
                  torrent.path
                )}
                {renderDetailItem(
                  <Hash size={14} />,
                  "Hash (v1)",
                  torrent.hash
                )}
                {renderDetailItem(
                  <Hash size={14} />,
                  "Hash (v2)",
                  `${torrent.hash.substring(0, 8)}...${torrent.hash.substring(
                    torrent.hash.length - 8
                  )}`
                )}
                {renderDetailItem(<Clock size={14} />, "ETA", torrent.eta)}
                {renderDetailItem(
                  <Download size={14} />,
                  "Download Speed",
                  torrent.downloadSpeed > 0
                    ? `${torrent.downloadSpeed} MB/s`
                    : "0 KB/s"
                )}
                {renderDetailItem(
                  <Upload size={14} />,
                  "Upload Speed",
                  torrent.uploadSpeed > 0
                    ? `${torrent.uploadSpeed} MB/s`
                    : "0 KB/s"
                )}
                {renderDetailItem(
                  <Share2 size={14} />,
                  "Share Ratio",
                  torrent.ratio
                )}
                {renderDetailItem(
                  <FileText size={14} />,
                  "Pieces",
                  `${torrent.pieces} x ${torrent.pieceSize}`
                )}
              </div>
            </div>
          </>
        );
      case "trackers":
        return (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-green-900/30">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Seeds
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Peers
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Latency
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Last Checked
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-900/20">
                  {trackers.map((tracker, index) => (
                    <tr key={index} className="hover:bg-green-900/10">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {tracker.url}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            tracker.status === "Working"
                              ? "bg-green-900/30 text-green-400"
                              : "bg-red-900/30 text-red-400"
                          }`}
                        >
                          {tracker.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {tracker.seeds}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {tracker.peers}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {tracker.latency}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {tracker.lastChecked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mt-4 text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-3 rounded-md transition-colors">
              Add Tracker
            </button>
          </div>
        );
      case "peers":
        return (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-green-900/30">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Download
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Upload
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-900/20">
                  {peers.map((peer, index) => (
                    <tr key={index} className="hover:bg-green-900/10">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {peer.ip}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {peer.client}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {peer.country}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {peer.downloadSpeed}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {peer.uploadSpeed}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                        <div className="w-24 bg-gray-800 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-600"
                            style={{
                              width: `${peer.progress}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-green-400">
                          {peer.progress}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "seeds":
        return (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-green-900/30">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Upload Speed
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Ratio
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Uptime
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-900/20">
                  {seeds.map((seed, index) => (
                    <tr key={index} className="hover:bg-green-900/10">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.ip}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.client}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.country}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.uploadSpeed}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.ratio}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-400">
                        {seed.uptime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case "files":
        return (
          <div className="mt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-green-900/30">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-900/20">
                  {renderFileTree(filesTree)}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between">
              <div className="text-xs text-green-500">
                <span className="font-semibold">Total Files:</span>{" "}
                {filesTree.length} files, 2 directories
              </div>
              <div className="space-x-2">
                <button className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-3 rounded-md transition-colors">
                  Expand All
                </button>
                <button className="text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1 px-3 rounded-md transition-colors">
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="border-t border-green-900/30 bg-black h-64 overflow-y-auto text-sm">
      <div className="flex justify-between items-center p-3 border-b border-green-900/30 bg-gray-950 sticky top-0">
        <div className="flex items-center">
          <div
            className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(
              torrent.status
            ).replace("text-", "bg-")}`}
          ></div>
          <h3 className="text-green-400 font-semibold truncate">
            {torrent.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      {/* Tabs navigation */}
      <div className="flex border-b border-green-900/30 bg-gray-950/50 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-green-500 text-green-400"
                : "border-transparent text-green-600 hover:text-green-500 hover:border-green-700"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="p-4">{renderTabContent()}</div>
    </div>
  );
}
