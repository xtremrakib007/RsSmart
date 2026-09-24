import { useState, useEffect } from 'react'
import api from '../services/api.js'
import './ProductsPage.css'

function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [priceLevels, setPriceLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [pricingProduct, setPricingProduct] = useState(null)
  const [productPrices, setProductPrices] = useState([])
  const [quantityRules, setQuantityRules] = useState([])
  const [formData, setFormData] = useState({
    name: '', description: '', sku: '', price: '', cost: '',
    stockQuantity: '', lowStockThreshold: 10, categoryId: '', imageUrl: ''
  })
  const [priceForm, setPriceForm] = useState({ priceLevelId: '', price: '' })
  const [ruleForm, setRuleForm] = useState({ priceLevelId: '', minQuantity: 1, maxQuantity: '', unitPrice: '' })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchPriceLevels()
  }, [search])

  const fetchProducts = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await api.get(`/products${params}`)
      setProducts(res.data.data.products)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories')
      setCategories(res.data.data.categories)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
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

  const fetchProductPricing = async (productId) => {
    try {
      const [pricesRes, rulesRes] = await Promise.all([
        api.get(`/pricing/products/${productId}`),
        api.get(`/pricing/products/${productId}/rules`)
      ])
      setProductPrices(pricesRes.data.data.prices)
      setQuantityRules(rulesRes.data.data.rules)
    } catch (err) {
      console.error('Failed to fetch pricing:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        cost: parseFloat(formData.cost) || 0,
        stockQuantity: parseInt(formData.stockQuantity) || 0,
        lowStockThreshold: parseInt(formData.lowStockThreshold) || 10
      }
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload)
      } else {
        await api.post('/products', payload)
      }
      setShowForm(false)
      setEditingProduct(null)
      resetForm()
      fetchProducts()
    } catch (err) {
      alert(err.message || 'Failed to save product')
    }
  }

  const handleSetPrice = async (e) => {
    e.preventDefault()
    if (!pricingProduct) return
    try {
      await api.post(`/pricing/products/${pricingProduct.id}`, {
        productId: pricingProduct.id,
        priceLevelId: priceForm.priceLevelId,
        price: parseFloat(priceForm.price) || 0
      })
      fetchProductPricing(pricingProduct.id)
      setPriceForm({ priceLevelId: '', price: '' })
    } catch (err) {
      alert(err.message || 'Failed to set price')
    }
  }

  const handleCreateRule = async (e) => {
    e.preventDefault()
    if (!pricingProduct) return
    try {
      await api.post(`/pricing/products/${pricingProduct.id}/rules`, {
        productId: pricingProduct.id,
        priceLevelId: ruleForm.priceLevelId,
        minQuantity: parseInt(ruleForm.minQuantity) || 1,
        maxQuantity: ruleForm.maxQuantity ? parseInt(ruleForm.maxQuantity) : null,
        unitPrice: parseFloat(ruleForm.unitPrice) || 0
      })
      fetchProductPricing(pricingProduct.id)
      setRuleForm({ priceLevelId: '', minQuantity: 1, maxQuantity: '', unitPrice: '' })
    } catch (err) {
      alert(err.message || 'Failed to create rule')
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      description: product.description || '',
      sku: product.sku || '',
      price: product.price || '',
      cost: product.cost || '',
      stockQuantity: product.stock_quantity || '',
      lowStockThreshold: product.low_stock_threshold || 10,
      categoryId: product.category_id || '',
      imageUrl: product.image_url || ''
    })
    setShowForm(true)
  }

  const openPricing = (product) => {
    setPricingProduct(product)
    fetchProductPricing(product.id)
    setShowPricing(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await api.delete(`/products/${id}`)
      fetchProducts()
    } catch (err) {
      alert(err.message || 'Failed to delete product')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', description: '', sku: '', price: '', cost: '',
      stockQuantity: '', lowStockThreshold: 10, categoryId: '', imageUrl: ''
    })
  }

  const openNewForm = () => {
    setEditingProduct(null)
    resetForm()
    setShowForm(true)
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(price)
  }

  const getStockBadge = (qty, threshold) => {
    if (qty <= 0) return <span className="badge badge-danger">Out of Stock</span>
    if (qty <= threshold) return <span className="badge badge-warning">Low Stock ({qty})</span>
    return <span className="badge badge-success">In Stock ({qty})</span>
  }

  return (
    <div className="products-page">
      <div className="page-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={openNewForm}>
          + Add Product
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>SKU</label>
                  <input value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="2" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Retail Price (MYR) *</label>
                  <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Cost (MYR)</label>
                  <input type="number" step="0.01" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Stock Quantity *</label>
                  <input type="number" value={formData.stockQuantity} onChange={(e) => setFormData({...formData, stockQuantity: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Low Stock Alert</label>
                  <input type="number" value={formData.lowStockThreshold} onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}>
                  <option value="">-- Select Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">{editingProduct ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPricing && pricingProduct && (
        <div className="modal-overlay" onClick={() => setShowPricing(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Pricing: {pricingProduct.name}</h3>

            <div className="pricing-sections">
              <div className="pricing-section">
                <h4>Price Levels</h4>
                <table className="data-table small">
                  <thead>
                    <tr><th>Level</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    {productPrices.map(pp => (
                      <tr key={pp.id}>
                        <td>{pp.price_level_name}</td>
                        <td>{formatPrice(pp.price)}</td>
                      </tr>
                    ))}
                    {productPrices.length === 0 && <tr><td colSpan="2" className="empty-state">No prices set</td></tr>}
                  </tbody>
                </table>
                <form onSubmit={handleSetPrice} className="inline-form">
                  <select value={priceForm.priceLevelId} onChange={(e) => setPriceForm({...priceForm, priceLevelId: e.target.value})} required>
                    <option value="">Select level</option>
                    {priceLevels.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                  <input type="number" step="0.01" placeholder="Price" value={priceForm.price} onChange={(e) => setPriceForm({...priceForm, price: e.target.value})} required />
                  <button type="submit" className="btn-primary">Set</button>
                </form>
              </div>

              <div className="pricing-section">
                <h4>Quantity Pricing Rules</h4>
                <table className="data-table small">
                  <thead>
                    <tr><th>Level</th><th>Min Qty</th><th>Max Qty</th><th>Unit Price</th></tr>
                  </thead>
                  <tbody>
                    {quantityRules.map(r => (
                      <tr key={r.id}>
                        <td>{r.price_level_name}</td>
                        <td>{r.min_quantity}</td>
                        <td>{r.max_quantity || '∞'}</td>
                        <td>{formatPrice(r.unit_price)}</td>
                      </tr>
                    ))}
                    {quantityRules.length === 0 && <tr><td colSpan="4" className="empty-state">No rules set</td></tr>}
                  </tbody>
                </table>
                <form onSubmit={handleCreateRule} className="inline-form">
                  <select value={ruleForm.priceLevelId} onChange={(e) => setRuleForm({...ruleForm, priceLevelId: e.target.value})} required>
                    <option value="">Level</option>
                    {priceLevels.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Min" value={ruleForm.minQuantity} onChange={(e) => setRuleForm({...ruleForm, minQuantity: e.target.value})} required style={{width: 60}} />
                  <input type="number" placeholder="Max" value={ruleForm.maxQuantity} onChange={(e) => setRuleForm({...ruleForm, maxQuantity: e.target.value})} style={{width: 60}} />
                  <input type="number" step="0.01" placeholder="Price" value={ruleForm.unitPrice} onChange={(e) => setRuleForm({...ruleForm, unitPrice: e.target.value})} required style={{width: 90}} />
                  <button type="submit" className="btn-primary">Add</button>
                </form>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowPricing(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <div className="products-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Retail Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">No products found</td></tr>
              ) : (
                products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-img">{p.image_url ? '🖼️' : '📦'}</div>
                        <div>
                          <div className="product-name">{p.name}</div>
                          <div className="product-desc">{p.description?.substring(0, 50)}{p.description?.length > 50 ? '...' : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.sku || '-'}</td>
                    <td>{p.category_name || '-'}</td>
                    <td className="price">{formatPrice(p.price)}</td>
                    <td>{getStockBadge(p.stock_quantity, p.low_stock_threshold)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => handleEdit(p)} title="Edit">✏️</button>
                        <button className="btn-icon" onClick={() => openPricing(p)} title="Pricing">💰</button>
                        <button className="btn-icon" onClick={() => handleDelete(p.id)} title="Delete">🗑️</button>
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

export default ProductsPage
