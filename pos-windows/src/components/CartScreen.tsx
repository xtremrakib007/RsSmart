import { useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { Minus, Plus, Trash2, ArrowLeft, CreditCard, ShoppingBag } from 'lucide-react';

export default function CartScreen() {
  const navigate = useNavigate();
  const cartItems = usePosStore(s => s.cartItems);
  const updateQuantity = usePosStore(s => s.updateQuantity);
  const removeFromCart = usePosStore(s => s.removeFromCart);
  const clearCart = usePosStore(s => s.clearCart);
  const subtotal = usePosStore(s => s.cartSubtotal());
  const tax = usePosStore(s => s.cartTax());
  const total = usePosStore(s => s.cartTotal());

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <ShoppingBag className="w-16 h-16 mb-4" />
        <p className="text-lg">Your cart is empty</p>
        <button onClick={() => navigate('/catalog')} className="mt-4 text-primary-600 hover:underline">
          Browse products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/catalog')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>
        <button onClick={clearCart} className="text-red-600 hover:text-red-700 text-sm">
          Clear Cart
        </button>
      </div>

      <div className="space-y-3">
        {cartItems.map(item => (
          <div key={item.id} className="card flex items-center gap-4">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{item.productName}</h3>
              <p className="text-sm text-gray-500">${item.unitPrice.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="w-8 h-8 rounded-lg border hover:bg-gray-50 flex items-center justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-8 h-8 rounded-lg border hover:bg-gray-50 flex items-center justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="text-right min-w-[80px]">
              <p className="font-bold text-gray-900">${item.lineTotal.toFixed(2)}</p>
            </div>
            <button
              onClick={() => removeFromCart(item.id)}
              className="text-red-400 hover:text-red-600 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="font-bold text-lg">Total</span>
          <span className="font-bold text-lg text-primary-600">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full btn-primary h-12 flex items-center justify-center gap-2 mt-2"
        >
          <CreditCard className="w-4 h-4" />
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
