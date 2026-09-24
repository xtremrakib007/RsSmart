import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { processRefund } from '@/lib/tauri-api';
import { Receipt, DollarSign, MessageSquare, ArrowLeft, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';

export default function ReturnsScreen() {
  const navigate = useNavigate();
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRefund = async () => {
    setLoading(true);
    setResult(null);
    try {
      const refundAmount = parseFloat(amount) || 0;
      await processRefund(receiptNumber, refundAmount, reason || undefined);
      setResult({ success: true, message: 'Refund processed successfully' });
      setReceiptNumber('');
      setAmount('');
      setReason('');
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Refund failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <button onClick={() => navigate('/catalog')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="card">
        <div className="text-center mb-6">
          <RotateCcw className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Process Return</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Receipt className="w-3 h-3" />
              Receipt Number
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={e => setReceiptNumber(e.target.value)}
              className="input mt-1"
              placeholder="e.g. POS-123456"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Refund Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input mt-1"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Reason
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input mt-1 min-h-[80px]"
              placeholder="Why is this being returned?"
            />
          </div>

          {result && (
            <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
            </div>
          )}

          <button
            onClick={handleRefund}
            disabled={loading || !receiptNumber || !amount}
            className="w-full btn-danger h-11 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Process Refund
          </button>
        </div>
      </div>
    </div>
  );
}
