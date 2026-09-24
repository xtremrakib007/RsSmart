import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { getProducts, searchProducts, getProductByBarcode } from '@/lib/tauri-api';
import { Search, Plus, ShoppingCart, Barcode } from 'lucide-react';
import type { Product } from '@/types';

export default function ProductCatalog() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const cartItems = usePosStore(s => s.cartItems);
  const addToCart = usePosStore(s => s.addToCart);
  const itemCount = usePosStore(s => s.itemCount());

  const loadProducts = useCallback(async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim()) {
        try {
          const data = await searchProducts(search);
          setProducts(data);
        } catch (e) {}
      } else {
        loadProducts();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadProducts]);

  const handleBarcode = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      try {
        const product = await getProductByBarcode(barcodeInput.trim());
        if (product) {
          addToCart(product);
          setBarcodeInput('');
        }
      } catch (e) {}
    }
  };

  const getCartQty = (productId: string) => {
    return cartItems.find(i => i.productId === productId)?.quantity || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Barcode */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input pl-9"
          />
        </div>
        <div className="w-64 relative">
          <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcode}
            placeholder="Scan barcode..."
            className="input pl-9"
            autoFocus
          />
        </div>
        {itemCount > 0 && (
          <button onClick={() => navigate('/cart')} className="btn-primary flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Cart ({itemCount})
          </button>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {products.map(product => {
          const qty = getCartQty(product.id);
          return (
            <div key={product.id} className="card hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400 text-sm">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  product.name[0]
                )}
              </div>
              <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{product.name}</h3>
              <p className="text-xs text-gray-500">{product.sku}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-primary-600 font-bold">${product.unitPrice.toFixed(2)}</span>
                {qty > 0 && (
                  <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                    {qty} in cart
                  </span>
                )}
              </div>
              <button
                onClick={() => addToCart(product)}
                disabled={product.stockQuantity <= 0}
                className="w-full mt-2 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {product.stockQuantity > 0 ? 'Add' : 'Out of Stock'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
