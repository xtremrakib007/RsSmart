import { useState, useEffect } from 'react';
import { getSyncHealth, triggerSync } from '@/lib/tauri-api';
import { RefreshCw, Wifi, AlertTriangle, CheckCircle, Server, Clock } from 'lucide-react';
import type { SyncHealth } from '@/types';

export default function SyncMonitor() {
  const [devices, setDevices] = useState<SyncHealth[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const data = await getSyncHealth();
      setDevices(data);
    } catch (e) {}
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await triggerSync();
      await loadHealth();
    } catch (e) {}
    setLoading(false);
  };

  const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
    HEALTHY: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    WARNING: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    CRITICAL: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync Monitoring</h1>
          <p className="text-gray-500">{devices.length} connected devices</p>
        </div>
        <button onClick={handleSync} disabled={loading} className="btn-primary flex items-center gap-1">
          {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <RefreshCw className="w-4 h-4" />}
          Force Sync
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map(device => {
          const config = statusConfig[device.status] || statusConfig.HEALTHY;
          const StatusIcon = config.icon;
          return (
            <div key={device.deviceId} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Server className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-medium">{device.deviceName}</p>
                    <p className="text-xs text-gray-500 font-mono">{device.deviceId}</p>
                  </div>
                </div>
                <span className={`badge ${device.status === 'HEALTHY' ? 'badge-green' : device.status === 'WARNING' ? 'badge-yellow' : 'badge-red'}`}>
                  {device.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Wifi className="w-3 h-3" /> Last Sync</span>
                  <span>{device.lastSync ? new Date(device.lastSync).toLocaleString() : 'Never'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Latency</span>
                  <span>{device.latencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pending</span>
                  <span className="font-medium">{device.pendingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Failed</span>
                  <span className={`font-medium ${device.failedCount > 0 ? 'text-red-600' : ''}`}>{device.failedCount}</span>
                </div>
              </div>
            </div>
          );
        })}
        {devices.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Server className="w-12 h-12 mx-auto mb-3" />
            <p>No sync devices configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
