import { create } from 'zustand';
import { CartItem, PosSession, Product, PosOrder } from '@/types';

interface PosState {
  // Session
  currentSession: PosSession | null;
  setSession: (session: PosSession | null) => void;

  // Cart
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (cartItemId: number, quantity: number) => void;
  removeFromCart: (cartItemId: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  cartSubtotal: () => number;
  cartTax: () => number;
  itemCount: () => number;

  // Products
  products: Product[];
  setProducts: (products: Product[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Orders
  lastOrder: PosOrder | null;
  setLastOrder: (order: PosOrder | null) => void;
}

export const usePosStore = create<PosState>((set, get) => ({
  currentSession: null,
  setSession: (session) => set({ currentSession: session }),

  cartItems: [],
  addToCart: (product, quantity = 1) => {
    const items = get().cartItems;
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const tax = product.unitPrice * newQty * product.taxRate;
      const total = product.unitPrice * newQty + tax;
      set({
        cartItems: items.map(i =>
          i.id === existing.id
            ? { ...i, quantity: newQty, taxAmount: tax, lineTotal: total }
            : i
        ),
      });
    } else {
      const tax = product.unitPrice * quantity * product.taxRate;
      const total = product.unitPrice * quantity + tax;
      const newItem: CartItem = {
        id: Date.now(),
        sessionId: get().currentSession?.id || '',
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity,
        discountAmount: 0,
        taxAmount: tax,
        lineTotal: total,
        notes: null,
      };
      set({ cartItems: [...items, newItem] });
    }
  },
  updateQuantity: (cartItemId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }
    set({
      cartItems: get().cartItems.map(i =>
        i.id === cartItemId
          ? {
              ...i,
              quantity,
              lineTotal: i.unitPrice * quantity + i.taxAmount,
            }
          : i
      ),
    });
  },
  removeFromCart: (cartItemId) => {
    set({ cartItems: get().cartItems.filter(i => i.id !== cartItemId) });
  },
  clearCart: () => set({ cartItems: [] }),
  cartTotal: () => get().cartItems.reduce((sum, i) => sum + i.lineTotal, 0),
  cartSubtotal: () => get().cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
  cartTax: () => get().cartItems.reduce((sum, i) => sum + i.taxAmount, 0),
  itemCount: () => get().cartItems.reduce((sum, i) => sum + i.quantity, 0),

  products: [],
  setProducts: (products) => set({ products }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  lastOrder: null,
  setLastOrder: (order) => set({ lastOrder: order }),
}));
