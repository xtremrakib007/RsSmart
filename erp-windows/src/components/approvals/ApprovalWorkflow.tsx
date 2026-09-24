import { useState, useEffect } from 'react';
import { getApprovals, approveRequest, rejectRequest } from '@/lib/tauri-api';
import { CheckCircle, XCircle, Clock, MessageSquare, User, FileText } from 'lucide-react';
import type { ApprovalWorkflow as ApprovalType } from '@/types';

export default function ApprovalWorkflow() {
  const [approvals, setApprovals] = useState<ApprovalType[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selected, setSelected] = useState<ApprovalType | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    getApprovals().then(setApprovals).catch(() => {});
  }, []);

  const filtered = approvals.filter(a => filter === 'all' || a.status.toLowerCase() === filter);
  const pending = approvals.filter(a => a.status === 'PENDING');

  const handleApprove = async (id: string) => {
    await approveRequest(id, comment || undefined);
    const updated = await getApprovals();
    setApprovals(updated);
    setSelected(null);
    setComment('');
  };

  const handleReject = async (id: string) => {
    await rejectRequest(id, comment || undefined);
    const updated = await getApprovals();
    setApprovals(updated);
    setSelected(null);
    setComment('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Workflow</h1>
          <p className="text-gray-500">{pending.length} pending • {approvals.length} total</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
            {f} {f === 'pending' && pending.length > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 rounded-full">{pending.length}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(req => (
          <div key={req.id} className={`card border-l-4 ${req.status === 'PENDING' ? 'border-l-yellow-500' : req.status === 'APPROVED' ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${req.status === 'PENDING' ? 'bg-yellow-50' : req.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {req.status === 'PENDING' ? <Clock className="w-5 h-5 text-yellow-600" /> :
                   req.status === 'APPROVED' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                   <XCircle className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <p className="font-medium">{req.entityName}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> {req.entityType} •
                    <User className="w-3 h-3" /> {req.requestedByName} •
                    <Clock className="w-3 h-3" /> {new Date(req.requestedAt).toLocaleString()}
                  </p>
                  {req.comments && (
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {req.comments}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {req.status === 'PENDING' && (
                  <>
                    <button onClick={() => setSelected(req)} className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-100 font-medium">
                      Review
                    </button>
                  </>
                )}
                {req.status !== 'PENDING' && (
                  <span className={`badge ${req.status === 'APPROVED' ? 'badge-green' : 'badge-red'}`}>
                    {req.status} {req.approverName && `by ${req.approverName}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3" />
            <p>No approvals found</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Review Request</h3>
            <p className="text-gray-500 mb-4">{selected.entityName} ({selected.entityType})</p>
            <div className="mb-4">
              <label className="text-sm font-medium flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Comments</label>
              <textarea className="input min-h-[80px] mt-1" value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comments..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleReject(selected.id)} className="flex-1 btn-danger">Reject</button>
              <button onClick={() => handleApprove(selected.id)} className="flex-1 btn-primary">Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
