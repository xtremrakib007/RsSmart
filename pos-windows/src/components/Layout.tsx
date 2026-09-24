import { Outlet, Link, useLocation } from 'react-router-dom';
import { usePosStore } from '@/lib/store';
import { ShoppingCart, Package, RotateCcw, Wifi, WifiOff, Printer, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPendingSyncCount, getBranding, logout } from '@/lib/tauri-api';

export default function Layout() {
  const location = useLocation();
  const session = usePosStore(s => s.currentSession);
  const itemCount = usePosStore(s => s.itemCount());
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Company-configurable branding — defaults to "RsSmart-POS" until this
  // deployment sets RSSMART_BRAND_NAME (see api/branding.rs).
  const [brandName, setBrandName] = useState('RsSmart-POS');
  useEffect(() => {
    getBranding().then(b => setBrandName(b.display_name)).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getPendingSyncCount().then(setPendingSync).catch(() => {});
      setIsOnline(navigator.onLine);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/', label: 'Session', icon: null },
    { path: '/catalog', label: 'Catalog', icon: Package },
    { path: '/cart', label: `Cart (${itemCount})`, icon: ShoppingCart },
    { path: '/returns', label: 'Returns', icon: RotateCcw },
    { path: '/sync', label: `Sync (${pendingSync})`, icon: null },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Printer className="w-6 h-6 text-primary-600" />
          <h1 className="text-lg font-bold text-gray-900">{brandName}</h1>
          {session && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Session Open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <span className="text-xs text-gray-500">{isOnline ? 'Online' : 'Offline'}</span>
          <button
            onClick={() => logout().then(() => window.location.reload())}
            className="ml-2 p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-1">
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
