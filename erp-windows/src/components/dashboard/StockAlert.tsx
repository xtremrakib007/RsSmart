import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '@/types';

interface Props {
  products: Product[];
}

export default function StockAlert({ products }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          Low Stock
        </h3>
        <Link to="/inventory" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-gray-500">SKU: {p.sku}</p>
            </div>
            <span className={`badge ${p.stockQuantity <= 0 ? 'badge-red' : 'badge-yellow'}`}>
              {p.stockQuantity} left
            </span>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No low stock items</p>
        )}
      </div>
    </div>
  );
}
