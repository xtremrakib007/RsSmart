import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { openSession, closeSession } from '@/lib/tauri-api';
import { DollarSign, Lock, Unlock, AlertCircle } from 'lucide-react';

export default function SessionScreen() {
  const navigate = useNavigate();
  const session = usePosStore(s => s.currentSession);
  const setSession = usePosStore(s => s.setSession);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showClose, setShowClose] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    setError('');
    try {
      const cash = parseFloat(openingCash) || 0;
      const newSession = await openSession(cash, notes || undefined);
      setSession(newSession);
      navigate('/catalog');
    } catch (e: any) {
      setError(e.message || 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError('');
    try {
      const cash = parseFloat(closingCash) || 0;
      await closeSession(cash, notes || undefined);
      setSession(null);
      setShowClose(false);
    } catch (e: any) {
      setError(e.message || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Unlock className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Active</h2>
          <div className="space-y-2 text-sm text-gray-600 mb-6">
            <p>Opened: {new Date(session.openedAt).toLocaleString()}</p>
            <p>Opening Cash: ${session.openingCash.toFixed(2)}</p>
            <p>Sales: ${session.totalSales.toFixed(2)}</p>
            <p>Transactions: {session.transactionCount}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/catalog')} className="btn-primary">
              Start Selling
            </button>
            <button onClick={() => setShowClose(true)} className="btn-danger">
              Close Session
            </button>
          </div>
        </div>

        {showClose && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold mb-4">Close Session</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Closing Cash</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={closingCash}
                      onChange={e => setClosingCash(e.target.value)}
                      className="input pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="input"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowClose(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleClose} disabled={loading} className="flex-1 btn-danger">
                  {loading ? 'Closing...' : 'Close Session'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="card">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Open Session</h2>
          <p className="text-gray-500 text-sm mt-1">Start your sales day</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Opening Cash</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="input pl-9"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input"
              placeholder="Optional notes..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleOpen}
            disabled={loading}
            className="w-full btn-primary h-11"
          >
            {loading ? 'Opening...' : 'Open Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
