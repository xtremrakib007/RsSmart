import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { printReceipt, openCashDrawer, recordPayment } from '@/lib/tauri-api';
import { CheckCircle, Printer, Drawer, ArrowRight, CreditCard, Banknote, Smartphone } from 'lucide-react';
import type { PaymentMethod, SplitPayment } from '@/types';

export default function PaymentScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const lastOrder = usePosStore(s => s.lastOrder);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [printState, setPrintState] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
  const [drawerOpened, setDrawerOpened] = useState(false);

  const order = lastOrder;
  const remaining = order ? order.grandTotal - splitPayments.reduce((s, p) => s + p.amount, 0) : 0;

  const handlePrint = async () => {
    if (!orderId) return;
    setPrintState('printing');
    try {
      await printReceipt(orderId);
      setPrintState('success');
    } catch (e) {
      setPrintState('error');
    }
  };

  const handleOpenDrawer = async () => {
    try {
      await openCashDrawer();
      setDrawerOpened(true);
      setTimeout(() => setDrawerOpened(false), 2000);
    } catch (e) {}
  };

  const handleAddSplit = () => {
    if (remaining <= 0) return;
    setSplitPayments([...splitPayments, { method, amount: remaining }]);
  };

  const handleComplete = async () => {
    if (!order || !orderId) return;
    try {
      if (isSplit && splitPayments.length > 0) {
        for (const payment of splitPayments) {
          await recordPayment({
            id: crypto.randomUUID(),
            orderId,
            sessionId: order.sessionId,
            amount: payment.amount,
            // Previously hardcoded to the literal string 'SPLIT', which threw
            // away which method each split leg actually used (and isn't a
            // method the backend accepts at all).
            method: payment.method,
            cardLastFour: null,
            cardType: null,
            mobileProvider: payment.method === 'MOBILE' ? 'Generic' : null,
            mobileReference: payment.reference || null,
            isRefund: false,
            processedAt: Date.now(),
            syncStatus: 'PENDING',
            receiptNumber: order.receiptNumber,
          });
        }
      } else {
        await recordPayment({
          id: crypto.randomUUID(),
          orderId,
          sessionId: order.sessionId,
          amount: order.grandTotal,
          method,
          cardLastFour: null,
          cardType: null,
          mobileProvider: method === 'MOBILE' ? 'Generic' : null,
          mobileReference: null,
          isRefund: false,
          processedAt: Date.now(),
          syncStatus: 'PENDING',
          receiptNumber: order.receiptNumber,
        });
      }
    } catch (e) {}
  };

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No order found</p>
        <button onClick={() => navigate('/catalog')} className="mt-4 text-primary-600 hover:underline">
          New Sale
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
        <p className="text-gray-500">Receipt: {order.receiptNumber}</p>
        <p className="text-3xl font-bold text-primary-600 mt-2">${order.grandTotal.toFixed(2)}</p>
      </div>

      {/* Payment Method Selection */}
      <div className="card">
        <h3 className="font-medium mb-3">Payment Method</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['CASH', 'CARD', 'MOBILE'] as PaymentMethod[]).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                method === m && !isSplit
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {m === 'CASH' && <Banknote className="w-4 h-4 mx-auto mb-1" />}
              {m === 'CARD' && <CreditCard className="w-4 h-4 mx-auto mb-1" />}
              {m === 'MOBILE' && <Smartphone className="w-4 h-4 mx-auto mb-1" />}
              {m}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input
            type="checkbox"
            checked={isSplit}
            onChange={e => setIsSplit(e.target.checked)}
            className="rounded"
          />
          Split Payment
        </label>
      </div>

      {/* Split Payment Details */}
      {isSplit && (
        <div className="card text-left">
          <div className="flex justify-between text-sm mb-2">
            <span>Remaining:</span>
            <span className="font-bold">${remaining.toFixed(2)}</span>
          </div>
          {splitPayments.map((p, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b">
              <span>{p.method}</span>
              <span>${p.amount.toFixed(2)}</span>
            </div>
          ))}
          {remaining > 0 && (
            <button onClick={handleAddSplit} className="w-full mt-2 py-1 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
              + Add {method} Payment (${remaining.toFixed(2)})
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handlePrint}
          disabled={printState === 'printing'}
          className="w-full btn-secondary h-11 flex items-center justify-center gap-2"
        >
          {printState === 'printing' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Printer className="w-4 h-4" />
          )}
          {printState === 'success' ? 'Printed!' : 'Print Receipt'}
        </button>

        <button
          onClick={handleOpenDrawer}
          className="w-full py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
        >
          <Drawer className="w-4 h-4" />
          {drawerOpened ? 'Drawer Opened!' : 'Open Cash Drawer'}
        </button>

        <button
          onClick={() => { handleComplete(); navigate('/catalog'); }}
          className="w-full btn-primary h-11 flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          New Sale
        </button>
      </div>
    </div>
  );
}
