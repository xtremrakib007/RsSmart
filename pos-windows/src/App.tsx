import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePosStore } from '@/lib/store';
import { getOpenSession, getAuthStatus } from '@/lib/tauri-api';
import Layout from '@/components/Layout';
import LoginScreen from '@/components/LoginScreen';
import SessionScreen from '@/components/SessionScreen';
import ProductCatalog from '@/components/ProductCatalog';
import CartScreen from '@/components/CartScreen';
import CheckoutScreen from '@/components/CheckoutScreen';
import PaymentScreen from '@/components/PaymentScreen';
import ReturnsScreen from '@/components/ReturnsScreen';
import SyncDashboard from '@/components/SyncDashboard';

function App() {
  const setSession = usePosStore(s => s.setSession);
  // Sales, sessions and sync all need a real logged-in tenant/user — the app
  // used to skip this entirely and hardcode "tenant-1"/"user-001".
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then(status => setLoggedIn(status !== null))
      .catch(() => setLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    getOpenSession().then(session => {
      if (session) setSession(session);
    }).catch(() => {});
  }, [loggedIn, setSession]);

  if (!authChecked) return null;
  if (!loggedIn) return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<SessionScreen />} />
        <Route path="catalog" element={<ProductCatalog />} />
        <Route path="cart" element={<CartScreen />} />
        <Route path="checkout" element={<CheckoutScreen />} />
        <Route path="payment/:orderId" element={<PaymentScreen />} />
        <Route path="returns" element={<ReturnsScreen />} />
        <Route path="sync" element={<SyncDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
