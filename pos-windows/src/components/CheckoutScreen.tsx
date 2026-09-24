import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { createOrder } from '@/lib/tauri-api';
import { ArrowLeft, User, CheckCircle, AlertCircle } from 'lucide-react';

export default function CheckoutScreen() {
  const navigate = useNavigate();
  const session = usePosStore(s => s.currentSession);
  const cartItems = usePosStore(s => s.cartItems);
  const clearCart = usePosStore(s => s.clearCart);
  const setLastOrder = usePosStore(s => s.setLastOrder);
  const subtotal = usePosStore(s => s.cartSubtotal());
  const tax = usePosStore(s => s.cartTax());
  const total = usePosStore(s => s.cartTotal());

  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!session) {
      setError('No active session');
      return;
    }
    if (cartItems.length === 0) {
      setError('Cart is empty');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const order = await createOrder(
        session.id,
        cartItems,
        customerName || undefined
      );
      setLastOrder(order);
      clearCart();
      navigate(`/payment/${order.id}`);
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/cart')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Cart
      </button>

      <div className="card mb-4">
        <h2 className="text-xl font-bold mb-4">Order Summary</h2>
        <div className="space-y-2 max-h-48 overflow-auto">
          {cartItems.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.productName} x{item.quantity}</span>
              <span>${item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total</span>
            <span className="text-primary-600">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <User className="w-3 h-3" />
            Customer Name (optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="input mt-1"
            placeholder="Walk-in customer"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full btn-primary h-12 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Confirm & Pay
            </>
          )}
        </button>
      </div>
    </div>
  );
}
