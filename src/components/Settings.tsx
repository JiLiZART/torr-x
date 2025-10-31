import React, { useState } from 'react';
import { X, Monitor, Wifi, Download, Brush, Wrench, Save, RefreshCw, FolderOpen, Clock, Bell, Shield, Globe, HardDrive, FileText, Check, Lock, ToggleLeft, ToggleRight, Sliders, Server } from 'lucide-react';
interface SettingsProps {
  onClose: () => void;
}
interface SettingsTabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
}
export function Settings({
  onClose
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  // Remote connection settings state
  const [remoteHostname, setRemoteHostname] = useState('localhost');
  const [remotePort, setRemotePort] = useState(9091);
  const [remoteAuthEnabled, setRemoteAuthEnabled] = useState(false);
  const [remoteUsername, setRemoteUsername] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  // Mock data for tabs
  const tabs: SettingsTabProps[] = [{
    id: 'general',
    label: 'General',
    icon: <Monitor size={14} />
  }, {
    id: 'network',
    label: 'Network',
    icon: <Wifi size={14} />
  }, {
    id: 'downloads',
    label: 'Downloads',
    icon: <Download size={14} />
  }, {
    id: 'remote',
    label: 'Remote',
    icon: <Server size={14} />
  }, {
    id: 'appearance',
    label: 'Appearance',
    icon: <Brush size={14} />
  }, {
    id: 'advanced',
    label: 'Advanced',
    icon: <Wrench size={14} />
  }];
  // Mock save settings function
  const saveSettings = () => {
    setSavedStatus('Saving...');
    setTimeout(() => {
      setSavedStatus('Settings saved successfully!');
      setTimeout(() => setSavedStatus(null), 2000);
    }, 800);
  };
  const renderToggle = (isEnabled: boolean, onChange: () => void, label: string, description?: string) => <div className="flex items-center justify-between py-3 border-b border-green-900/20">
      <div>
        <h4 className="text-sm text-green-400">{label}</h4>
        {description && <p className="text-xs text-green-700 mt-0.5">{description}</p>}
      </div>
      <button className="text-green-500 focus:outline-none" onClick={onChange}>
        {isEnabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-green-700" />}
      </button>
    </div>;
  const renderNumberInput = (label: string, value: number, onChange: (value: number) => void, min: number, max: number, unit: string, description?: string) => <div className="flex items-center justify-between py-3 border-b border-green-900/20">
      <div>
        <h4 className="text-sm text-green-400">{label}</h4>
        {description && <p className="text-xs text-green-700 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center">
        <input type="number" className="w-16 bg-gray-900 border border-green-900/50 rounded px-2 py-1 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700" value={value} onChange={e => onChange(parseInt(e.target.value) || min)} min={min} max={max} />
        {unit && <span className="ml-2 text-sm text-green-500">{unit}</span>}
      </div>
    </div>;
  const renderTextInput = (label: string, value: string, onChange: (value: string) => void, placeholder: string, description?: string, type: string = 'text') => <div className="py-3 border-b border-green-900/20">
      <div className="mb-2">
        <h4 className="text-sm text-green-400">{label}</h4>
        {description && <p className="text-xs text-green-700 mt-0.5">{description}</p>}
      </div>
      <input type={type} className="w-full bg-gray-900 border border-green-900/50 rounded px-3 py-1.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>;
  const renderSelect = (label: string, value: string, options: {
    value: string;
    label: string;
  }[], description?: string) => <div className="py-3 border-b border-green-900/20">
      <div className="mb-2">
        <h4 className="text-sm text-green-400">{label}</h4>
        {description && <p className="text-xs text-green-700 mt-0.5">{description}</p>}
      </div>
      <select className="w-full bg-gray-900 border border-green-900/50 rounded px-3 py-1.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700" value={value}>
        {options.map(option => <option key={option.value} value={option.value}>
            {option.label}
          </option>)}
      </select>
    </div>;
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <div className="space-y-2">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Behavior
            </h3>
            {renderToggle(true, () => {}, 'Start TorrentX with system', 'Launch TorrentX automatically when your system starts')}
            {renderToggle(true, () => {}, 'Start minimized', 'Start TorrentX minimized to system tray')}
            {renderToggle(false, () => {}, 'Confirm exit while downloading', 'Show a confirmation dialog when exiting with active downloads')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Updates
            </h3>
            {renderToggle(true, () => {}, 'Check for updates automatically')}
            <div className="pt-2 flex">
              <button className="flex items-center text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1.5 px-3 rounded-md transition-colors">
                <RefreshCw size={12} className="mr-1.5" />
                Check for Updates
              </button>
              <div className="ml-3 text-xs text-green-500 flex items-center">
                <Check size={12} className="mr-1.5" />
                Running latest version (1.4.2)
              </div>
            </div>
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Language
            </h3>
            {renderSelect('Interface Language', 'en', [{
            value: 'en',
            label: 'English'
          }, {
            value: 'fr',
            label: 'French'
          }, {
            value: 'de',
            label: 'German'
          }, {
            value: 'es',
            label: 'Spanish'
          }, {
            value: 'ru',
            label: 'Russian'
          }, {
            value: 'zh',
            label: 'Chinese'
          }])}
          </div>;
      case 'network':
        return <div className="space-y-2">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Connection
            </h3>
            {renderNumberInput('Maximum connections per torrent', 100, () => {}, 10, 500, 'connections', 'Limiting this can improve performance on low-end devices')}
            {renderNumberInput('Maximum upload speed', 0, () => {}, 0, 10000, 'KB/s', '0 = unlimited')}
            {renderNumberInput('Maximum download speed', 0, () => {}, 0, 10000, 'KB/s', '0 = unlimited')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Listening Port
            </h3>
            {renderNumberInput('Port used for incoming connections', 6881, () => {}, 1024, 65535, '')}
            {renderToggle(true, () => {}, 'Use UPnP / NAT-PMP port forwarding', 'Automatically configure your router to allow incoming connections')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Proxy Server
            </h3>
            {renderSelect('Proxy type', 'none', [{
            value: 'none',
            label: 'None'
          }, {
            value: 'http',
            label: 'HTTP'
          }, {
            value: 'socks4',
            label: 'SOCKS4'
          }, {
            value: 'socks5',
            label: 'SOCKS5'
          }])}
            {renderTextInput('Proxy host', '', () => {}, 'host.example.com')}
            {renderNumberInput('Proxy port', 8080, () => {}, 1, 65535, '')}
            {renderToggle(false, () => {}, 'Authentication required')}
          </div>;
      case 'downloads':
        return <div className="space-y-2">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Save Location
            </h3>
            <div className="flex items-center py-3 border-b border-green-900/20">
              <input type="text" className="flex-1 bg-gray-900 border border-green-900/50 rounded-l px-3 py-1.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700" value="D:\Downloads\Torrents" />
              <button className="bg-green-900/50 hover:bg-green-900/70 text-green-400 py-1.5 px-3 rounded-r border border-green-900/50 transition-colors">
                <FolderOpen size={14} />
              </button>
            </div>
            {renderToggle(true, () => {}, 'Create subfolder for torrents with multiple files')}
            {renderToggle(false, () => {}, 'Move completed downloads to:', 'Automatically move completed downloads to a different folder')}
            <div className="flex items-center py-3 border-b border-green-900/20">
              <input type="text" className="flex-1 bg-gray-900 border border-green-900/50 rounded-l px-3 py-1.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700" value="D:\Downloads\Completed" disabled />
              <button className="bg-green-900/30 text-green-600 py-1.5 px-3 rounded-r border border-green-900/50 transition-colors cursor-not-allowed">
                <FolderOpen size={14} />
              </button>
            </div>
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Download Management
            </h3>
            {renderNumberInput('Maximum active downloads', 5, () => {}, 1, 50, '')}
            {renderNumberInput('Maximum active torrents', 8, () => {}, 1, 100, '')}
            {renderToggle(true, () => {}, 'Start torrents automatically')}
            {renderSelect('Default torrent priority', 'normal', [{
            value: 'low',
            label: 'Low'
          }, {
            value: 'normal',
            label: 'Normal'
          }, {
            value: 'high',
            label: 'High'
          }])}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Seeding
            </h3>
            {renderToggle(true, () => {}, 'Seed automatically')}
            {renderNumberInput('Minimum ratio', 1.0, () => {}, 0, 10, '', 'Stop seeding when this ratio is reached')}
            {renderNumberInput('Minimum seeding time', 60, () => {}, 0, 10000, 'minutes', 'Stop seeding after this much time')}
          </div>;
      case 'remote':
        return <div className="space-y-2">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Transmission RPC Connection
            </h3>
            <p className="text-xs text-green-600 mb-4">
              Connect to a remote Transmission daemon to manage torrents
              remotely
            </p>

            {renderTextInput('Hostname', remoteHostname, setRemoteHostname, 'localhost', 'IP address or hostname of the Transmission daemon')}

            {renderNumberInput('Port', remotePort, setRemotePort, 1, 65535, '', 'RPC port (default: 9091)')}

            {renderToggle(remoteAuthEnabled, () => setRemoteAuthEnabled(!remoteAuthEnabled), 'Authentication Required', 'Enable if the remote daemon requires username and password')}

            {remoteAuthEnabled && <>
                {renderTextInput('Username', remoteUsername, setRemoteUsername, 'username', 'Username for RPC authentication')}

                {renderTextInput('Password', remotePassword, setRemotePassword, '••••••••', 'Password for RPC authentication', 'password')}
              </>}

            <div className="pt-4">
              <button className="flex items-center text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1.5 px-3 rounded-md transition-colors">
                <Wifi size={12} className="mr-1.5" />
                Test Connection
              </button>
            </div>

            <div className="mt-6 bg-gray-900/50 border border-green-900/30 rounded-md p-3">
              <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                Connection Details
              </h4>
              <div className="space-y-1 text-xs text-green-500">
                <div className="flex justify-between">
                  <span className="text-green-700">URL:</span>
                  <span className="font-mono">
                    http://{remoteHostname}:{remotePort}/transmission/rpc
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Authentication:</span>
                  <span>{remoteAuthEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                {remoteAuthEnabled && <div className="flex justify-between">
                    <span className="text-green-700">Username:</span>
                    <span className="font-mono">
                      {remoteUsername || '(not set)'}
                    </span>
                  </div>}
              </div>
            </div>
          </div>;
      case 'appearance':
        return <div className="space-y-2">
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Theme
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border-2 border-green-500 p-1 rounded">
                <div className="bg-black h-20 rounded flex items-center justify-center">
                  <span className="text-green-500 text-xs">Hacker</span>
                </div>
              </div>
              <div className="border border-green-900/30 p-1 rounded">
                <div className="bg-gray-900 h-20 rounded flex items-center justify-center">
                  <span className="text-blue-400 text-xs">Dark Blue</span>
                </div>
              </div>
              <div className="border border-green-900/30 p-1 rounded">
                <div className="bg-gray-100 h-20 rounded flex items-center justify-center">
                  <span className="text-gray-800 text-xs">Light</span>
                </div>
              </div>
            </div>
            {renderToggle(false, () => {}, 'Use system theme')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Display Options
            </h3>
            {renderToggle(true, () => {}, 'Show speed graph in torrent details')}
            {renderToggle(true, () => {}, 'Show piece visualization')}
            {renderSelect('Date format', 'relative', [{
            value: 'relative',
            label: 'Relative (2 hours ago)'
          }, {
            value: 'absolute',
            label: 'Absolute (2023-04-15 14:30)'
          }, {
            value: 'iso',
            label: 'ISO (2023-04-15T14:30:00)'
          }])}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Notifications
            </h3>
            {renderToggle(true, () => {}, 'Show desktop notifications')}
            {renderToggle(true, () => {}, 'Notify when downloads complete')}
            {renderToggle(false, () => {}, 'Notify on added torrents')}
            {renderToggle(false, () => {}, 'Play sound when downloads complete')}
          </div>;
      case 'advanced':
        return <div className="space-y-2">
            <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-3 mb-4 rounded">
              <p className="text-xs text-yellow-400">
                Warning: These settings can affect application stability and
                performance. Only modify if you understand the consequences.
              </p>
            </div>
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
              Performance
            </h3>
            {renderNumberInput('Disk cache size', 32, () => {}, 8, 1024, 'MB', 'Larger cache may improve performance but uses more RAM')}
            {renderToggle(true, () => {}, 'Enable OS cache')}
            {renderToggle(false, () => {}, 'Enable super seeding', 'More efficient seeding but may disconnect some peers')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Security
            </h3>
            {renderToggle(true, () => {}, 'Enable DHT', 'Distributed Hash Table improves peer discovery')}
            {renderToggle(true, () => {}, 'Enable PeX', 'Peer Exchange improves peer discovery')}
            {renderToggle(true, () => {}, 'Enable Local Peer Discovery')}
            {renderToggle(false, () => {}, 'Anonymous mode', 'Disables features that might reveal your identity')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Experimental
            </h3>
            {renderToggle(false, () => {}, 'Enable sequential downloads')}
            {renderToggle(false, () => {}, 'Enable WebSocket tracker support')}
            <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mt-6 mb-3">
              Data Management
            </h3>
            <div className="pt-2 flex space-x-3">
              <button className="flex items-center text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1.5 px-3 rounded-md transition-colors">
                <FileText size={12} className="mr-1.5" />
                Export Settings
              </button>
              <button className="flex items-center text-xs bg-green-900/30 hover:bg-green-900/50 text-green-400 py-1.5 px-3 rounded-md transition-colors">
                <FileText size={12} className="mr-1.5" />
                Import Settings
              </button>
              <button className="flex items-center text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 py-1.5 px-3 rounded-md transition-colors">
                <RefreshCw size={12} className="mr-1.5" />
                Reset to Default
              </button>
            </div>
          </div>;
      default:
        return null;
    }
  };
  return <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-green-900/50 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-green-900/30">
          <h2 className="text-green-400 font-semibold flex items-center">
            <Sliders size={16} className="mr-2" />
            Settings
          </h2>
          <button onClick={onClose} className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-green-900/30 p-4 bg-black/30">
            {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center px-3 py-2 mb-1 rounded-md text-sm ${activeTab === tab.id ? 'bg-green-900/20 text-green-400' : 'text-green-600 hover:bg-gray-900 hover:text-green-500'}`}>
                <span className="mr-2">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>)}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">{renderTabContent()}</div>
        </div>
        <div className="border-t border-green-900/30 p-4 bg-black/30 flex items-center justify-between">
          {savedStatus && <div className="text-xs text-green-500 flex items-center">
              <Check size={12} className="mr-1.5" />
              {savedStatus}
            </div>}
          {!savedStatus && <div></div>}
          <div className="flex space-x-3">
            <button onClick={onClose} className="text-xs bg-gray-800 hover:bg-gray-700 text-green-400 py-1.5 px-4 rounded-md transition-colors">
              Cancel
            </button>
            <button onClick={saveSettings} className="flex items-center text-xs bg-green-800 hover:bg-green-700 text-green-100 py-1.5 px-4 rounded-md transition-colors">
              <Save size={12} className="mr-1.5" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>;
}