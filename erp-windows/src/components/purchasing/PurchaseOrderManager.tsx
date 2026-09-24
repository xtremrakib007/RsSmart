import { useState, useEffect } from 'react';
import { getPurchaseOrders, createPurchaseOrder, updatePoStatus } from '@/lib/tauri-api';
import { Plus, Search, CheckCircle, Clock, Truck, XCircle, FileText } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderItem } from '@/types';

export default function PurchaseOrderManager() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    getPurchaseOrders().then(setOrders).catch(() => {});
  }, []);

  const filtered = orders.filter(o =>
    o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    SENT: 'badge-blue',
    PARTIAL: 'badge-yellow',
    RECEIVED: 'badge-green',
    CANCELLED: 'badge-red',
  };

  const statusIcons: Record<string, any> = {
    DRAFT: Clock,
    SENT: FileText,
    PARTIAL: Truck,
    RECEIVED: CheckCircle,
    CANCELLED: XCircle,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-gray-500">{orders.length} total orders</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" /> Create PO
        </button>
      </div>

      <div className="card">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO number or supplier..."
            className="input pl-9"
          />
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="pb-2">PO Number</th>
                <th className="pb-2">Supplier</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Items</th>
                <th className="pb-2">Expected</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const StatusIcon = statusIcons[order.status] || Clock;
                return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 font-medium">{order.poNumber}</td>
                    <td className="py-3">{order.supplierName}</td>
                    <td className="py-3">
                      <span className={`badge ${statusColors[order.status] || 'badge-gray'} flex items-center gap-1 w-fit`}>
                        <StatusIcon className="w-3 h-3" /> {order.status}
                      </span>
                    </td>
                    <td className="py-3 font-medium">${order.totalAmount.toFixed(2)}</td>
                    <td className="py-3">{order.items.length}</td>
                    <td className="py-3 text-gray-500">
                      {order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedOrder(order)} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100">
                          View
                        </button>
                        {order.status === 'DRAFT' && (
                          <button onClick={() => handleStatus(order.id, 'SENT')} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100">
                            Send
                          </button>
                        )}
                        {order.status === 'SENT' && (
                          <button onClick={() => handleStatus(order.id, 'RECEIVED')} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">
                            Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreatePoModal onClose={() => setShowCreate(false)} onSave={() => getPurchaseOrders().then(setOrders)} />}
      {selectedOrder && <ViewPoModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );

  async function handleStatus(id: string, status: string) {
    await updatePoStatus(id, status);
    const updated = await getPurchaseOrders();
    setOrders(updated);
  }
}

function CreatePoModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [order, setOrder] = useState<Partial<PurchaseOrder>>({ status: 'DRAFT', items: [] });
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  const addItem = () => {
    setItems([...items, {
      id: crypto.randomUUID(),
      poId: '',
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      receivedQuantity: 0,
    }]);
  };

  const updateItem = (idx: number, field: keyof PurchaseOrderItem, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      updated[idx].totalPrice = updated[idx].quantity * updated[idx].unitPrice;
    }
    setItems(updated);
  };

  const total = items.reduce((s, i) => s + i.totalPrice, 0);

  const handleSave = async () => {
    const po: PurchaseOrder = {
      ...(order as PurchaseOrder),
      id: crypto.randomUUID(),
      poNumber: `PO-${Date.now()}`,
      items,
      subtotal: total,
      taxAmount: total * 0.1,
      totalAmount: total * 1.1,
      createdBy: 'admin',
      createdAt: Date.now(),
    };
    await createPurchaseOrder(po);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-4">Create Purchase Order</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm font-medium">Supplier</label>
            <input className="input" value={order.supplierName || ''} onChange={e => setOrder({ ...order, supplierName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">Expected Delivery</label>
            <input type="date" className="input" onChange={e => setOrder({ ...order, expectedDelivery: new Date(e.target.value).getTime() })} />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Items</h4>
            <button onClick={addItem} className="text-sm text-primary-600 hover:underline">+ Add Item</button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 items-end">
              <div className="col-span-2">
                <input className="input text-sm" placeholder="Product name" value={item.productName} onChange={e => updateItem(idx, 'productName', e.target.value)} />
              </div>
              <div>
                <input type="number" className="input text-sm" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))} />
              </div>
              <div>
                <input type="number" className="input text-sm" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value))} />
              </div>
              <div className="text-right font-medium">${item.totalPrice.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 flex justify-between items-center">
          <div className="text-right">
            <p className="text-sm text-gray-500">Subtotal: ${total.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Tax (10%): ${(total * 0.1).toFixed(2)}</p>
            <p className="text-lg font-bold">Total: ${(total * 1.1).toFixed(2)}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 btn-primary">Create PO</button>
        </div>
      </div>
    </div>
  );
}

function ViewPoModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold mb-2">PO #{order.poNumber}</h3>
        <p className="text-gray-500 mb-4">Supplier: {order.supplierName}</p>
        <table className="w-full text-sm mb-4">
          <thead className="border-b">
            <tr><th className="text-left pb-2">Product</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Price</th><th className="text-right pb-2">Total</th></tr>
          </thead>
          <tbody>
            {order.items.map(item => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-2">{item.productName}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                <td className="py-2 text-right">${item.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right font-bold text-lg">Total: ${order.totalAmount.toFixed(2)}</div>
        <button onClick={onClose} className="w-full mt-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
      </div>
    </div>
  );
}
