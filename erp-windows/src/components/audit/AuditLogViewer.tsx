import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/lib/tauri-api';
import { Search, Filter, Download, Eye, Clock, User, Activity } from 'lucide-react';
import type { AuditLog } from '@/types';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    getAuditLogs().then(setLogs).catch(() => {});
  }, []);

  const filtered = logs.filter(l =>
    (l.entityType.toLowerCase().includes(search.toLowerCase()) ||
     l.performedByName.toLowerCase().includes(search.toLowerCase()) ||
     l.action.toLowerCase().includes(search.toLowerCase())) &&
    (!filter || l.action === filter)
  );

  const actionColors: Record<string, string> = {
    CREATE: 'badge-green',
    UPDATE: 'badge-blue',
    DELETE: 'badge-red',
    LOGIN: 'badge-purple',
    EXPORT: 'badge-yellow',
    APPROVE: 'badge-green',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log Viewer</h1>
          <p className="text-gray-500">{logs.length} total entries</p>
        </div>
        <button className="btn-ghost flex items-center gap-1">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="card">
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="input pl-9" />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filter} onChange={e => setFilter(e.target.value)} className="input py-1.5 w-32">
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="EXPORT">Export</option>
              <option value="APPROVE">Approve</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b sticky top-0 bg-white">
              <tr>
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">User</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Entity</th>
                <th className="pb-2">Entity ID</th>
                <th className="pb-2">IP Address</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}</span>
                  </td>
                  <td className="py-2">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {log.performedByName}</span>
                  </td>
                  <td className="py-2">
                    <span className={`badge ${actionColors[log.action] || 'badge-gray'}`}>{log.action}</span>
                  </td>
                  <td className="py-2">{log.entityType}</td>
                  <td className="py-2 font-mono text-xs">{log.entityId.slice(0, 8)}...</td>
                  <td className="py-2 text-gray-500 text-xs">{log.ipAddress || '-'}</td>
                  <td className="py-2">
                    <button onClick={() => setSelectedLog(log)} className="p-1 hover:bg-gray-100 rounded">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" /> Audit Detail
            </h3>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">ID:</span><span className="col-span-2 font-mono">{selectedLog.id}</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Timestamp:</span><span className="col-span-2">{new Date(selectedLog.timestamp).toLocaleString()}</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">User:</span><span className="col-span-2">{selectedLog.performedByName} ({selectedLog.performedBy})</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Action:</span><span className="col-span-2"><span className={`badge ${actionColors[selectedLog.action] || 'badge-gray'}`}>{selectedLog.action}</span></span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">Entity:</span><span className="col-span-2">{selectedLog.entityType} / {selectedLog.entityId}</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-gray-500">IP:</span><span className="col-span-2">{selectedLog.ipAddress || 'N/A'}</span></div>
              {selectedLog.oldValues && (
                <div className="mt-3">
                  <p className="text-gray-500 font-medium mb-1">Old Values:</p>
                  <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">{selectedLog.oldValues}</pre>
                </div>
              )}
              {selectedLog.newValues && (
                <div className="mt-3">
                  <p className="text-gray-500 font-medium mb-1">New Values:</p>
                  <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">{selectedLog.newValues}</pre>
                </div>
              )}
            </div>
            <button onClick={() => setSelectedLog(null)} className="w-full mt-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
