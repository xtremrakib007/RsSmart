import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import MainLayout from './layouts/MainLayout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProductsPage from './pages/ProductsPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import WhatsAppPage from './pages/WhatsAppPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
