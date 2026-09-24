import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './CustomersPage.css'

function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [priceLevels, setPriceLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({
    phone: '', whatsappId: '', fullName: '', email: '',
    address: '', city: '', country: 'Malaysia', notes: '', tags: '',
    customerType: 'b2c', creditLimit: 0, paymentTerms: 'immediate', priceLevelId: ''
  })

  useEffect(() => {
    fetchCustomers()
    fetchPriceLevels()
  }, [search])

  const fetchCustomers = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await api.get(`/customers${params}`)
      setCustomers(res.data.data.customers)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPriceLevels = async () => {
    try {
      const res = await api.get('/pricing/levels')
      setPriceLevels(res.data.data.levels)
    } catch (err) {
      console.error('Failed to fetch price levels:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        creditLimit: parseFloat(formData.creditLimit) || 0,
        priceLevelId: formData.priceLevelId || null
      }
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload)
      } else {
        await api.post('/customers', payload)
      }
      setShowForm(false)
      setEditingCustomer(null)
      resetForm()
      fetchCustomers()
    } catch (err) {
      alert(err.message || 'Failed to save customer')
    }
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setFormData({
      phone: customer.phone || '',
      whatsappId: customer.whatsapp_id || '',
      fullName: customer.full_name || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      country: customer.country || 'Malaysia',
      notes: customer.notes || '',
      tags: (customer.tags || []).join(', '),
      customerType: customer.customer_type || 'b2c',
      creditLimit: customer.credit_limit || 0,
      paymentTerms: customer.payment_terms || 'immediate',
      priceLevelId: customer.price_level_id || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this customer?')) return
    try {
      await api.delete(`/customers/${id}`)
      fetchCustomers()
    } catch (err) {
      alert(err.message || 'Failed to delete customer')
    }
  }

  const resetForm = () => {
    setFormData({
      phone: '', whatsappId: '', fullName: '', email: '',
      address: '', city: '', country: 'Malaysia', notes: '', tags: '',
      customerType: 'b2c', creditLimit: 0, paymentTerms: 'immediate', priceLevelId: ''
    })
  }

  const openNewForm = () => {
    setEditingCustomer(null)
    resetForm()
    setShowForm(true)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount)
  }

  const getTypeBadge = (type) => {
    const map = { b2c: 'B2C', b2b: 'B2B', dealer: 'Dealer' }
    const colors = { b2c: '#3b82f6', b2b: '#8b5cf6', dealer: '#f59e0b' }
    return <span style={{ background: colors[type] || '#6b7280', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{map[type] || type}</span>
  }

  return (
    <div className="customers-page">
      <div className="page-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={openNewForm}>
          + Add Customer
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
            <form onSubmit={handleSubmit} className="customer-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+6012-345-6789" required />
                </div>
                <div className="form-group">
                  <label>WhatsApp ID</label>
                  <input value={formData.whatsappId} onChange={(e) => setFormData({...formData, whatsappId: e.target.value})} placeholder="Optional" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} rows="2" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Customer Type</label>
                  <select value={formData.customerType} onChange={(e) => setFormData({...formData, customerType: e.target.value})}>
                    <option value="b2c">B2C (Retail)</option>
                    <option value="b2b">B2B (Wholesale)</option>
                    <option value="dealer">Dealer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price Level</label>
                  <select value={formData.priceLevelId} onChange={(e) => setFormData({...formData, priceLevelId: e.target.value})}>
                    <option value="">Auto (by type)</option>
                    {priceLevels.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formData.customerType !== 'b2c' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Credit Limit (RM)</label>
                    <input type="number" step="0.01" value={formData.creditLimit} onChange={(e) => setFormData({...formData, creditLimit: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <select value={formData.paymentTerms} onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}>
                      <option value="immediate">Immediate</option>
                      <option value="net_15">Net 15</option>
                      <option value="net_30">Net 30</option>
                      <option value="net_60">Net 60</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input value={formData.tags} onChange={(e) => setFormData({...formData, tags: e.target.value})} placeholder="vip, repeat, new" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows="2" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingCustomer ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading customers...</div>
      ) : (
        <div className="customers-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan="8" className="empty-state">No customers found</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">{c.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                          <div className="customer-name">{c.full_name || 'Unnamed'}</div>
                          <div className="customer-email">{c.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.phone}</td>
                    <td>{getTypeBadge(c.customer_type)}</td>
                    <td>{c.city ? `${c.city}, ${c.country}` : c.country}</td>
                    <td>{c.total_orders}</td>
                    <td className="price">{formatCurrency(c.total_spent)}</td>
                    <td>
                      <div className="tags">
                        {(c.tags || []).map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => handleEdit(c)} title="Edit">✏️</button>
                        <button className="btn-icon" onClick={() => handleDelete(c.id)} title="Delete">🗑️</button>
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

export default CustomersPage
