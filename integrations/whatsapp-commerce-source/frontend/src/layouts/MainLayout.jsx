import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import './MainLayout.css'

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, businesses, selectedBusiness, selectBusiness } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/products', label: 'Products', icon: '📦' },
    { path: '/orders', label: 'Orders', icon: '🛒' },
    { path: '/customers', label: 'Customers', icon: '👥' },
    { path: '/inventory', label: 'Inventory', icon: '📋' },
    { path: '/whatsapp', label: 'WhatsApp', icon: '💬' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">💬</span>
            <span className="logo-text">WhatsApp Commerce</span>
          </div>
          {businesses.length > 0 && (
            <select
              className="business-selector"
              value={selectedBusiness || ''}
              onChange={(e) => selectBusiness(e.target.value)}
              style={{ marginTop: 10, width: '100%', padding: '6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}
            >
              {businesses.map((b) => (
                <option key={b.business_id} value={b.business_id}>
                  {b.name} ({b.role_name})
                </option>
              ))}
            </select>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-item logout-btn">
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <h1 className="page-title">
            {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="top-bar-user">
            <span className="user-name">{user?.fullName || user?.email || 'User'}</span>
            <span className="user-avatar">👤</span>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default MainLayout
