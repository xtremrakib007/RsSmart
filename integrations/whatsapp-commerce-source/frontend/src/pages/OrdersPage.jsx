import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './OrdersPage.css'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#f59e0b' },
  { value: 'confirmed', label: 'Confirmed', color: '#3b82f6' },
  { value: 'processing', label: 'Processing', color: '#8b5cf6' },
  { value: 'shipped', label: 'Shipped', color: '#06b6d4' },
  { value: 'delivered', label: 'Delivered', color: '#22c55e' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
]

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [orderNotes, setOrderNotes] = useState('')

  useEffect(() => {
    fetchOrders()
    fetchCustomers()
    fetchProducts()
  }, [search, statusFilter])

  const fetchOrders = async () => {
    try {
      let params = ''
      const q = []
      if (search) q.push(`search=${encodeURIComponent(search)}`)
      if (statusFilter) q.push(`status=${encodeURIComponent(statusFilter)}`)
      if (q.length) params = '?' + q.join('&')
      const res = await api.get(`/orders${params}`)
      setOrders(res.data.orders)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers')
      setCustomers(res.data.customers)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products')
      setProducts(res.data.products.filter(p => p.is_active && p.stock_quantity > 0))
    } catch (err) {
      console.error('Failed to fetch products:', err)
    }
  }

  const addToCart = (product) => {
    const existing = cartItems.find(item => item.productId === product.id)
    if (existing) {
      setCartItems(cartItems.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
          : item
      ))
    } else {
      setCartItems([...cartItems, {
        productId: product.id,
        productName: product.name,
        unitPrice: parseFloat(product.price),
        quantity: 1,
        totalPrice: parseFloat(product.price)
      }])
    }
  }

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCartItems(cartItems.filter(item => item.productId !== productId))
    } else {
      setCartItems(cartItems.map(item =>
        item.productId === productId
          ? { ...item, quantity: qty, totalPrice: qty * item.unitPrice }
          : item
      ))
    }
  }

  const cartTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)

  const handleCreateOrder = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer')
      return
    }
    if (cartItems.length === 0) {
      alert('Please add at least one product')
      return
    }
    try {
      await api.post('/orders', {
        customerId: selectedCustomer,
        items: cartItems,
        notes: orderNotes
      })
      setShowForm(false)
      setCartItems([])
      setSelectedCustomer('')
      setOrderNotes('')
      fetchOrders()
    } catch (err) {
      alert(err.message || 'Failed to create order')
    }
  }

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      fetchOrders()
      if (showDetail) {
        const res = await api.get(`/orders/${orderId}`)
        setShowDetail(res.data.order)
      }
    } catch (err) {
      alert(err.message || 'Failed to update status')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this order?')) return
    try {
      await api.delete(`/orders/${id}`)
      fetchOrders()
    } catch (err) {
      alert(err.message || 'Failed to delete order')
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(price)
  }

  const getStatusBadge = (status) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
    return <span className="status-badge" style={{ background: `${opt.color}15`, color: opt.color, borderColor: `${opt.color}30` }}>{opt.label}</span>
  }

  const openNewForm = () => {
    setCartItems([])
    setSelectedCustomer('')
    setOrderNotes('')
    setShowForm(true)
  }

  return (
    <div className="orders-page">
      <div className="page-toolbar">
        <div className="search-filters">
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={openNewForm}>
          + New Order
        </button>
      </div>

      {/* Create Order Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Order</h3>
            <div className="order-form">
              <div className="form-group">
                <label>Customer *</label>
                <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name || c.phone} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div className="order-form-grid">
                <div className="product-picker">
                  <h4>Products</h4>
                  <div className="product-list">
                    {products.map(p => (
                      <div key={p.id} className="product-picker-item" onClick={() => addToCart(p)}>
                        <span className="picker-name">{p.name}</span>
                        <span className="picker-price">{formatPrice(p.price)}</span>
                        <span className="picker-stock">Stock: {p.stock_quantity}</span>
                        <button className="btn-add">+</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cart-panel">
                  <h4>Cart ({cartItems.length})</h4>
                  {cartItems.length === 0 ? (
                    <p className="empty-cart">Click products to add</p>
                  ) : (
                    <div className="cart-items">
                      {cartItems.map(item => (
                        <div key={item.productId} className="cart-item">
                          <div className="cart-item-info">
                            <span className="cart-item-name">{item.productName}</span>
                            <span className="cart-item-price">{formatPrice(item.unitPrice)} each</span>
                          </div>
                          <div className="cart-item-qty">
                            <button onClick={() => updateCartQty(item.productId, item.quantity - 1)}>-</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.productId, item.quantity + 1)}>+</button>
                          </div>
                          <span className="cart-item-total">{formatPrice(item.totalPrice)}</span>
                        </div>
                      ))}
                      <div className="cart-total">
                        <span>Total:</span>
                        <span className="total-amount">{formatPrice(cartTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows="2" placeholder="Optional order notes..." />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={handleCreateOrder} disabled={cartItems.length === 0 || !selectedCustomer}>
                  Create Order ({formatPrice(cartTotal)})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <h3>Order #{showDetail.id.slice(0, 8)}</h3>
              {getStatusBadge(showDetail.status)}
            </div>

            <div className="detail-section">
              <h4>Customer</h4>
              <p><strong>{showDetail.customer_name}</strong></p>
              <p>{showDetail.customer_phone}</p>
            </div>

            <div className="detail-section">
              <h4>Items</h4>
              <table className="detail-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {showDetail.items?.map(item => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatPrice(item.unit_price)}</td>
                      <td>{formatPrice(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detail-totals">
              <div className="total-row"><span>Subtotal:</span><span>{formatPrice(showDetail.subtotal)}</span></div>
              <div className="total-row"><span>Tax:</span><span>{formatPrice(showDetail.tax_amount)}</span></div>
              <div className="total-row"><span>Shipping:</span><span>{formatPrice(showDetail.shipping_amount)}</span></div>
              <div className="total-row grand"><span>Total:</span><span>{formatPrice(showDetail.total_amount)}</span></div>
            </div>

            {showDetail.notes && (
              <div className="detail-section">
                <h4>Notes</h4>
                <p className="detail-notes">{showDetail.notes}</p>
              </div>
            )}

            <div className="detail-actions">
              <h4>Update Status</h4>
              <div className="status-buttons">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    className={`status-btn ${showDetail.status === s.value ? 'active' : ''}`}
                    style={{ '--status-color': s.color }}
                    onClick={() => handleStatusChange(showDetail.id, s.value)}
                    disabled={showDetail.status === s.value}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowDetail(null)}>Close</button>
              <button className="btn-danger" onClick={() => { handleDelete(showDetail.id); setShowDetail(null); }}>
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading orders...</div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No orders found</td></tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id}>
                    <td className="order-id">#{o.id.slice(0, 8)}</td>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-name">{o.customer_name}</div>
                        <div className="customer-phone">{o.customer_phone}</div>
                      </div>
                    </td>
                    <td>-</td>
                    <td className="price">{formatPrice(o.total_amount)}</td>
                    <td>{getStatusBadge(o.status)}</td>
                    <td className="date">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => setShowDetail(o)} title="View">👁️</button>
                        <button className="btn-icon" onClick={() => handleDelete(o.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
