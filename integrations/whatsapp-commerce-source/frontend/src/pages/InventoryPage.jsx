import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './InventoryPage.css'

function InventoryPage() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [adjustForm, setAdjustForm] = useState({ quantityChange: 0, reason: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchInventory()
  }, [statusFilter])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      let url = '/inventory'
      const params = []
      if (statusFilter) params.push(`status=${statusFilter}`)
      if (params.length) url += '?' + params.join('&')
      const res = await api.get(url)
      setInventory(res.data.data.inventory)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMovements = async (productId) => {
    try {
      const res = await api.get(`/inventory/${productId}/movements`)
      setMovements(res.data.data.movements)
    } catch (err) {
      console.error(err)
    }
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    if (!selectedProduct) return
    try {
      const res = await api.post(`/inventory/${selectedProduct.id}/adjust`, adjustForm)
      setMessage(`Stock adjusted: ${res.data.data.previousStock} → ${res.data.data.newStock}`)
      fetchInventory()
      fetchMovements(selectedProduct.id)
      setAdjustForm({ quantityChange: 0, reason: '' })
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setMessage(err.message || 'Adjustment failed')
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const filtered = inventory.filter(i =>
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(filter.toLowerCase()))
  )

  const getStatusBadge = (status) => {
    const map = {
      in_stock: { icon: '🟢', label: 'In Stock', class: 'status-ok' },
      low_stock: { icon: '🟡', label: 'Low Stock', class: 'status-warn' },
      out_of_stock: { icon: '🔴', label: 'Out of Stock', class: 'status-danger' }
    }
    const s = map[status] || { icon: '⚪', label: status, class: '' }
    return <span className={`status-badge ${s.class}`}>{s.icon} {s.label}</span>
  }

  return (
    <div className="inventory-page">
      <div className="page-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {message && <div className="alert">{message}</div>}

      <div className="inventory-layout">
        <div className="inventory-list">
          {loading ? (
            <div className="loading">Loading inventory...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">No products found</td></tr>
                ) : (
                  filtered.map(item => (
                    <tr key={item.id} className={selectedProduct?.id === item.id ? 'selected' : ''}>
                      <td>
                        <div className="product-cell">
                          <div className="product-img">📦</div>
                          <div>
                            <div className="product-name">{item.name}</div>
                            <div className="product-desc">{item.category_name || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{item.sku || '-'}</td>
                      <td className="stock-qty">{item.stock_quantity}</td>
                      <td>{item.low_stock_threshold}</td>
                      <td>{getStatusBadge(item.stock_status)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" onClick={() => { setSelectedProduct(item); fetchMovements(item.id); }} title="Manage">⚙️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {selectedProduct && (
          <div className="inventory-detail">
            <h3>{selectedProduct.name}</h3>
            <div className="detail-stats">
              <div className="stat">
                <span className="stat-label">Current Stock</span>
                <span className="stat-value">{selectedProduct.stock_quantity}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Low Stock Threshold</span>
                <span className="stat-value">{selectedProduct.low_stock_threshold}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Status</span>
                <span className="stat-value">{getStatusBadge(selectedProduct.stock_status)}</span>
              </div>
            </div>

            <h4>Adjust Stock</h4>
            <form onSubmit={handleAdjust} className="adjust-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity Change (+/-)</label>
                  <input
                    type="number"
                    value={adjustForm.quantityChange}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <input
                    type="text"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    placeholder="e.g. Damaged goods"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">Apply Adjustment</button>
            </form>

            <h4>Movement History</h4>
            <div className="movements-list">
              {movements.length === 0 ? (
                <div className="empty-state">No movements yet</div>
              ) : (
                movements.map(m => (
                  <div key={m.id} className={`movement-item ${m.quantity_change > 0 ? 'in' : 'out'}`}>
                    <div className="movement-header">
                      <span className="movement-type">{m.movement_type}</span>
                      <span className="movement-date">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="movement-body">
                      <span className={`movement-qty ${m.quantity_change > 0 ? 'positive' : 'negative'}`}>
                        {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                      </span>
                      <span className="movement-reason">{m.reason || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InventoryPage
