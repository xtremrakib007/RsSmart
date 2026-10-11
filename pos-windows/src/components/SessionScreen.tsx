import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { openSession, closeSession } from '@/lib/tauri-api';
import { Lock, Unlock, AlertCircle, Banknote } from 'lucide-react';

const DENOMINATIONS = [
  { label: 'RM100 note', cents: 10000 },
  { label: 'RM50 note', cents: 5000 },
  { label: 'RM20 note', cents: 2000 },
  { label: 'RM10 note', cents: 1000 },
  { label: 'RM5 note', cents: 500 },
  { label: 'RM1 note', cents: 100 },
  { label: '50 sen coin', cents: 50 },
  { label: '20 sen coin', cents: 20 },
  { label: '10 sen coin', cents: 10 },
  { label: '5 sen coin', cents: 5 },
] as const;

type Counts = Record<string, string>;
const emptyCounts = (): Counts => Object.fromEntries(DENOMINATIONS.map(d => [String(d.cents), '0']));
const money = (cents: number) => `RM ${(cents / 100).toFixed(2)}`;

function DenominationCounter({
  title,
  counts,
  onChange,
}: {
  title: string;
  counts: Counts;
  onChange: (next: Counts) => void;
}) {
  const totalCents = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d.cents * (Number.parseInt(counts[String(d.cents)] || '0', 10) || 0), 0),
    [counts],
  );

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <span className="font-bold text-primary-700 tabular-nums">{money(totalCents)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {DENOMINATIONS.map(d => (
          <label key={d.cents} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-700">{d.label}</span>
            <input
              aria-label={`${title} ${d.label} count`}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={counts[String(d.cents)] ?? '0'}
              onChange={e => {
                const value = e.target.value;
                if (value !== '' && (!(/^[0-9]+$/.test(value)) || Number(value) < 0)) return;
                onChange({ ...counts, [String(d.cents)]: value });
              }}
              className="input w-24 text-right"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">Enter the number of notes or coins, not the cash amount.</p>
    </section>
  );
}

function countTotalCents(counts: Counts) {
  return DENOMINATIONS.reduce(
    (sum, d) => sum + d.cents * (Number.parseInt(counts[String(d.cents)] || '0', 10) || 0),
    0,
  );
}

export default function SessionScreen() {
  const navigate = useNavigate();
  const session = usePosStore(s => s.currentSession);
  const setSession = usePosStore(s => s.setSession);
  const [openingCounts, setOpeningCounts] = useState<Counts>(emptyCounts);
  const [closingCounts, setClosingCounts] = useState<Counts>(emptyCounts);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showClose, setShowClose] = useState(false);

  const openingCents = countTotalCents(openingCounts);
  const closingCents = countTotalCents(closingCounts);

  const handleOpen = async () => {
    setLoading(true);
    setError('');
    try {
      const newSession = await openSession(openingCents / 100, notes.trim() || undefined);
      setSession(newSession);
      navigate('/catalog');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError('');
    try {
      await closeSession(closingCents / 100, notes.trim() || undefined);
      setSession(null);
      setShowClose(false);
      setClosingCounts(emptyCounts());
      setNotes('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return (
      <div className="max-w-2xl mx-auto mt-8 space-y-4">
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Unlock className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Session Active</h2>
          <div className="space-y-2 text-sm text-gray-600 mb-6">
            <p>Opened: {new Date(session.openedAt).toLocaleString()}</p>
            <p>Opening Cash: {money(Math.round(session.openingCash * 100))}</p>
            <p>Sales: {money(Math.round(session.totalSales * 100))}</p>
            <p>Transactions: {session.transactionCount}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/catalog')} className="btn-primary">Start Selling</button>
            <button onClick={() => { setError(''); setClosingCounts(emptyCounts()); setShowClose(true); }} className="btn-danger">Close Session</button>
          </div>
        </div>

        {showClose && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Close Session — Cash Count</h3>
              <DenominationCounter title="Closing drawer count" counts={closingCounts} onChange={setClosingCounts} />
              <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Counted cash</span>
                <strong className="text-lg">{money(closingCents)}</strong>
              </div>
              <label className="block mt-4 text-sm font-medium text-gray-700">
                Notes (optional)
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input mt-1" placeholder="Cash variance or shift notes" />
              </label>
              {error && <div role="alert" className="flex items-center gap-2 text-red-600 text-sm mt-3"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowClose(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleClose} disabled={loading} className="flex-1 btn-danger">{loading ? 'Closing...' : 'Confirm Close'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="card">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Open Session</h2>
          <p className="text-gray-500 text-sm mt-1">Count the cash float before starting your sales day.</p>
        </div>
        <DenominationCounter title="Opening cash float" counts={openingCounts} onChange={setOpeningCounts} />
        <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-primary-50">
          <span className="text-sm text-gray-700 flex items-center gap-2"><Banknote className="w-4 h-4" />Opening cash total</span>
          <strong className="text-xl text-primary-700">{money(openingCents)}</strong>
        </div>
        <label className="block mt-4 text-sm font-medium text-gray-700">
          Shift notes (optional)
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input mt-1" placeholder="Opening float or shift notes" />
        </label>
        {error && <div role="alert" className="flex items-center gap-2 text-red-600 text-sm mt-3"><AlertCircle className="w-4 h-4" />{error}</div>}
        <button onClick={handleOpen} disabled={loading} className="w-full btn-primary h-11 mt-5">
          {loading ? 'Opening...' : 'Confirm Cash Count & Open Session'}
        </button>
      </div>
    </div>
  );
}
