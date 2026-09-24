import { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useErpStore } from '@/lib/store';
import { getProducts, getInventoryMovements, saveProduct, deleteProduct, recordMovement } from '@/lib/tauri-api';
import { Plus, Search, Filter, Download, AlertTriangle } from 'lucide-react';
import type { Product, InventoryMovement } from '@/types';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const lowStock = useErpStore(s => s.lowStockProducts());

  const loadData = useCallback(async () => {
    const [p, m] = await Promise.all([getProducts(), getInventoryMovements()]);
    setProducts(p);
    setMovements(m);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search)
  );

  const columnDefs = [
    { field: 'sku', headerName: 'SKU', width: 120, sortable: true, filter: true },
    { field: 'name', headerName: 'Product Name', flex: 1, sortable: true, filter: true },
    { field: 'categoryName', headerName: 'Category', width: 130, sortable: true },
    { field: 'unitPrice', headerName: 'Price', width: 100, valueFormatter: (p: any) => `$${p.value.toFixed(2)}` },
    { field: 'stockQuantity', headerName: 'Stock', width: 100, cellStyle: (p: any) => ({
      color: p.value <= (p.data.reorderLevel || 0) ? '#d32f2f' : '#388e3c',
      fontWeight: 'bold',
    })},
    { field: 'reorderLevel', headerName: 'Reorder', width: 100 },
    { field: 'unitOfMeasure', headerName: 'UOM', width: 80 },
    { field: 'isActive', headerName: 'Active', width: 90, cellRenderer: (p: any) =>
      p.value ? <span className="badge-green">Yes</span> : <span className="badge-red">No</span>
    },
    {
      headerName: 'Actions',
      width: 150,
      cellRenderer: (p: any) => (
        <div className="flex gap-1">
          <button onClick={() => { setSelectedProduct(p.data); setShowMove(true); }} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100">
            Move
          </button>
          <button onClick={() => handleDelete(p.data.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100">
            Del
          </button>
        </div>
      ),
    },
  ];

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await deleteProduct(id);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-gray-500">{products.length} products • {lowStock.length} low stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button className="btn-ghost flex items-center gap-1">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">{lowStock.length} products below reorder level</span>
        </div>
      )}

      <div className="card">
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, SKU, or barcode..."
              className="input pl-9"
            />
          </div>
          <button className="btn-ghost flex items-center gap-1">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        <div className="ag-theme-alpine" style={{ height: 500 }}>
          <AgGridReact
            rowData={filtered}
            columnDefs={columnDefs}
            pagination={true}
            paginationPageSize={20}
            animateRows={true}
            rowSelection="single"
            onRowClicked={(e) => setSelectedProduct(e.data)}
          />
        </div>
      </div>

      {/* Add Product Modal */}
      {showAdd && <ProductModal onClose={() => setShowAdd(false)} onSave={loadData} />}
      {showMove && selectedProduct && <MovementModal product={selectedProduct} onClose={() => setShowMove(false)} onSave={loadData} />}
    </div>
  );
}

function ProductModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [product, setProduct] = useState<Partial<Product>>({ isActive: true, taxRate: 0, stockQuantity: 0, reorderLevel: 10 });

  const handleSave = async () => {
    await saveProduct(product as Product);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-4">Add Product</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium">Name</label>
            <input className="input" value={product.name || ''} onChange={e => setProduct({ ...product, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">SKU</label>
            <input className="input" value={product.sku || ''} onChange={e => setProduct({ ...product, sku: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Barcode</label>
            <input className="input" value={product.barcode || ''} onChange={e => setProduct({ ...product, barcode: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Unit Price</label>
            <input type="number" className="input" value={product.unitPrice || ''} onChange={e => setProduct({ ...product, unitPrice: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Cost Price</label>
            <input type="number" className="input" value={product.costPrice || ''} onChange={e => setProduct({ ...product, costPrice: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Stock Qty</label>
            <input type="number" className="input" value={product.stockQuantity || ''} onChange={e => setProduct({ ...product, stockQuantity: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Reorder Level</label>
            <input type="number" className="input" value={product.reorderLevel || ''} onChange={e => setProduct({ ...product, reorderLevel: parseFloat(e.target.value) })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Save Product</button>
        </div>
      </div>
    </div>
  );
}

function MovementModal({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: () => void }) {
  const [movement, setMovement] = useState<Partial<InventoryMovement>>({
    productId: product.id,
    productName: product.name,
    type: 'IN',
    quantity: 1,
    unitCost: product.costPrice || 0,
  });

  const handleSave = async () => {
    await recordMovement(movement as InventoryMovement);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">Stock Movement: {product.name}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Type</label>
            <select className="input" value={movement.type} onChange={e => setMovement({ ...movement, type: e.target.value as any })}>
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Quantity</label>
            <input type="number" className="input" value={movement.quantity || ''} onChange={e => setMovement({ ...movement, quantity: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Unit Cost</label>
            <input type="number" className="input" value={movement.unitCost || ''} onChange={e => setMovement({ ...movement, unitCost: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-sm font-medium">Reference</label>
            <input className="input" value={movement.reference || ''} onChange={e => setMovement({ ...movement, reference: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea className="input min-h-[60px]" value={movement.notes || ''} onChange={e => setMovement({ ...movement, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Record Movement</button>
        </div>
      </div>
    </div>
  );
}
