import { useEffect, useState } from 'react';
import { useErpStore } from '@/lib/store';
import { getDashboardKpis } from '@/lib/tauri-api';
import KpiCard from './KpiCard';
import SalesChart from './SalesChart';
import StockAlert from './StockAlert';
import RecentActivity from './RecentActivity';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, AlertTriangle, Clock } from 'lucide-react';

export default function Dashboard() {
  const [kpis, setKpis] = useState({
    revenue: 0, expenses: 0, profit: 0, salesCount: 0,
    lowStockCount: 0, pendingPoCount: 0, pendingApprovalCount: 0,
  });
  const lowStock = useErpStore(s => s.lowStockProducts());
  const pendingApprovals = useErpStore(s => s.pendingApprovals());

  useEffect(() => {
    getDashboardKpis().then(setKpis).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your business performance</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={`$${kpis.revenue.toLocaleString()}`}
          change={12.5}
          icon={DollarSign}
          color="green"
        />
        <KpiCard
          title="Total Expenses"
          value={`$${kpis.expenses.toLocaleString()}`}
          change={-3.2}
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          title="Net Profit"
          value={`$${kpis.profit.toLocaleString()}`}
          change={8.7}
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          title="Sales Count"
          value={kpis.salesCount.toString()}
          change={5.1}
          icon={ShoppingCart}
          color="purple"
        />
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium">Low Stock Alerts</p>
              <p className="text-2xl font-bold">{lowStock.length}</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium">Pending POs</p>
              <p className="text-2xl font-bold">{kpis.pendingPoCount}</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium">Pending Approvals</p>
              <p className="text-2xl font-bold">{pendingApprovals.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold mb-4">Sales vs Expenses (Last 30 Days)</h3>
          <SalesChart />
        </div>
        <div className="space-y-4">
          <StockAlert products={lowStock.slice(0, 5)} />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
