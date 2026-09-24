import { useState, useEffect } from 'react';
import { getOfflineQueue, triggerSync, getPendingSyncCount } from '@/lib/tauri-api';
import { RefreshCw, Wifi, WifiOff, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import type { OfflineQueueItem } from '@/types';

export default function SyncDashboard() {
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const loadQueue = async () => {
    try {
      const data = await getOfflineQueue();
      setQueue(data);
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (e) {}
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    const onlineHandler = () => setIsOnline(true);
    const offlineHandler = () => setIsOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      await triggerSync();
      await loadQueue();
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Sync Dashboard</h2>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <Wifi className="w-4 h-4" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 text-sm">
              <WifiOff className="w-4 h-4" /> Offline
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={loading || !isOnline}
            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <Database className="w-6 h-6 text-primary-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{pendingCount}</p>
          <p className="text-xs text-gray-500">Pending Items</p>
        </div>
        <div className="card text-center">
          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{queue.filter(i => i.status === 'COMPLETED').length}</p>
          <p className="text-xs text-gray-500">Synced</p>
        </div>
        <div className="card text-center">
          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold">{queue.filter(i => i.status === 'FAILED').length}</p>
          <p className="text-xs text-gray-500">Failed</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium mb-3">Queue Details</h3>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="pb-2">Type</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Retries</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{item.entityType}</td>
                  <td className="py-2">{item.action}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                      item.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2">{item.retryCount}/{item.maxRetries}</td>
                  <td className="py-2 text-gray-500">{new Date(item.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">Queue is empty</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
