import { useState, useEffect } from 'react';
import { getChartOfAccounts, getJournalEntries, createJournalEntry, postJournalEntry } from '@/lib/tauri-api';
import { Plus, Search, CheckCircle, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import type { ChartOfAccount, JournalEntry, JournalLine } from '@/types';

export default function AccountingModule() {
  const [tab, setTab] = useState<'coa' | 'journals'>('coa');
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  useEffect(() => {
    getChartOfAccounts().then(setAccounts).catch(() => {});
    getJournalEntries().then(setJournals).catch(() => {});
  }, []);

  const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
  const typeColors: Record<string, string> = {
    ASSET: 'text-blue-700 bg-blue-50',
    LIABILITY: 'text-red-700 bg-red-50',
    EQUITY: 'text-purple-700 bg-purple-50',
    REVENUE: 'text-green-700 bg-green-50',
    EXPENSE: 'text-orange-700 bg-orange-50',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounting</h1>
          <p className="text-gray-500">Chart of accounts & journal entries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJournal(true)} className="btn-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> New Journal
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('coa')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'coa' ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
          Chart of Accounts
        </button>
        <button onClick={() => setTab('journals')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'journals' ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
          Journal Entries
        </button>
      </div>

      {tab === 'coa' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="input pl-9" />
          </div>
          {accountTypes.map(type => {
            const typeAccounts = accounts.filter(a => a.type === type && (a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)));
            if (typeAccounts.length === 0) return null;
            return (
              <div key={type} className="card">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeColors[type]}`}>{type}</span>
                  <span className="text-gray-500 text-sm">{typeAccounts.length} accounts</span>
                </h3>
                <div className="space-y-1">
                  {typeAccounts.map(account => (
                    <div key={account.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg cursor-pointer" onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}>
                      <div className="flex items-center gap-3">
                        {expandedAccount === account.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="font-mono text-sm text-gray-500 w-16">{account.code}</span>
                        <span className="font-medium">{account.name}</span>
                      </div>
                      <span className={`font-bold ${account.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        ${account.balance.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'journals' && (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="pb-2">Entry #</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Debit</th>
                <th className="pb-2">Credit</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {journals.map(j => (
                <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 font-medium">{j.entryNumber}</td>
                  <td className="py-3">{new Date(j.date).toLocaleDateString()}</td>
                  <td className="py-3">{j.description}</td>
                  <td className="py-3">${j.totalDebit.toFixed(2)}</td>
                  <td className="py-3">${j.totalCredit.toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`badge ${j.status === 'POSTED' ? 'badge-green' : j.status === 'DRAFT' ? 'badge-yellow' : 'badge-red'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {j.status === 'DRAFT' && (
                      <button onClick={() => handlePost(j.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">
                        Post
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showJournal && <JournalModal onClose={() => setShowJournal(false)} onSave={() => getJournalEntries().then(setJournals)} />}
    </div>
  );

  async function handlePost(id: string) {
    await postJournalEntry(id);
    const updated = await getJournalEntries();
    setJournals(updated);
  }
}

function JournalModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), journalId: '', accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
    { id: crypto.randomUUID(), journalId: '', accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
  ]);

  const updateLine = (idx: number, field: keyof JournalLine, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), journalId: '', accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' }]);
  };

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSave = async () => {
    if (!isBalanced) return;
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      entryNumber: `JE-${Date.now()}`,
      date: new Date(date).getTime(),
      reference: null,
      description,
      totalDebit,
      totalCredit,
      isBalanced,
      status: 'DRAFT',
      lines,
      createdBy: 'admin',
      createdAt: Date.now(),
      postedAt: null,
    };
    await createJournalEntry(entry);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-4">New Journal Entry</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm font-medium">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium">
            <div className="col-span-4">Account</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Debit</div>
            <div className="col-span-2">Credit</div>
          </div>
          {lines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <input className="input text-sm" placeholder="Account name" value={line.accountName} onChange={e => updateLine(idx, 'accountName', e.target.value)} />
              </div>
              <div className="col-span-3">
                <input className="input text-sm" value={line.description || ''} onChange={e => updateLine(idx, 'description', e.target.value)} />
              </div>
              <div className="col-span-2">
                <input type="number" className="input text-sm" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <input type="number" className="input text-sm" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          ))}
          <button onClick={addLine} className="text-sm text-primary-600 hover:underline">+ Add Line</button>
        </div>

        <div className={`flex items-center gap-2 p-3 rounded-lg ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {isBalanced ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">
            Total Debit: ${totalDebit.toFixed(2)} | Total Credit: ${totalCredit.toFixed(2)}
            {isBalanced ? ' (Balanced)' : ' (Unbalanced)'}
          </span>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={!isBalanced} className="flex-1 btn-primary disabled:opacity-50">Save Journal</button>
        </div>
      </div>
    </div>
  );
}
