import { Outlet, Link, useLocation } from 'react-router-dom';
import { useErpStore } from '@/lib/store';
import { getBranding } from '@/lib/tauri-api';
import {
  LayoutDashboard, Package, ShoppingCart, BookOpen, Users,
  FileText, ClipboardList, CheckSquare, Wifi, Bell, Search, Menu, X
} from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/purchasing', label: 'Purchasing', icon: ShoppingCart },
  { path: '/accounting', label: 'Accounting', icon: BookOpen },
  { path: '/hr', label: 'HR & Users', icon: Users },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/audit', label: 'Audit Logs', icon: ClipboardList },
  { path: '/approvals', label: 'Approvals', icon: CheckSquare },
  { path: '/sync', label: 'Sync Monitor', icon: Wifi },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pendingApprovals = useErpStore(s => s.pendingApprovals());
  const lowStock = useErpStore(s => s.lowStockProducts());

  // Company-configurable branding — defaults to "RsSmart-ERP" until this
  // deployment sets RSSMART_BRAND_NAME (see api/branding.rs).
  const [brandName, setBrandName] = useState('RsSmart-ERP');
  useEffect(() => {
    getBranding().then(b => setBrandName(b.display_name)).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200">
          {sidebarOpen && <span className="font-bold text-lg text-primary-700">{brandName}</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto p-1 hover:bg-gray-100 rounded">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            const badge = item.path === '/approvals' && pendingApprovals.length > 0
              ? pendingApprovals.length
              : item.path === '/inventory' && lowStock.length > 0
              ? lowStock.length
              : null;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-colors relative ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                {badge !== null && (
                  <span className={`absolute right-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    item.path === '/approvals' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-gray-800">
              {navItems.find(n => n.path === location.pathname)?.label || 'ERP'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Global search..." className="input pl-9 w-64 text-sm" />
            </div>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-600" />
              {(pendingApprovals.length + lowStock.length) > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
