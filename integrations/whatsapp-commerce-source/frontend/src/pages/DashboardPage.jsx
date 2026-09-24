import { useState, useEffect } from 'react';
import api from '../services/api';
import './DashboardPage.css';

const DATE_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '7 Days', value: '7days' },
  { label: '30 Days', value: '30days' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
];

export default function DashboardPage() {
  const [range, setRange] = useState('30days');
  const [metrics, setMetrics] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [b2cB2b, setB2cB2b] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [mRes, sRes, oRes, bRes] = await Promise.all([
        api.get(`/analytics/dashboard?range=${range}`),
        api.get(`/analytics/sales-over-time?range=${range}`),
        api.get(`/analytics/orders-over-time?range=${range}`),
        api.get(`/analytics/b2c-vs-b2b?range=${range}`),
      ]);
      setMetrics(mRes.data.data);
      setSalesData(sRes.data.data.series);
      setOrdersData(oRes.data.data.series);
      setB2cB2b(bRes.data.data.breakdown);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(val || 0);
  };

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Business Dashboard</h1>
        <div className="range-selector">
          {DATE_RANGES.map(r => (
            <button
              key={r.value}
              className={range === r.value ? 'active' : ''}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Sales</div>
          <div className="metric-value">{formatCurrency(metrics?.sales_total)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Orders</div>
          <div className="metric-value">{metrics?.orders_count || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Order Value</div>
          <div className="metric-value">{formatCurrency(metrics?.avg_order_value)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">New Customers</div>
          <div className="metric-value">{metrics?.customers_new || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Repeat Customers</div>
          <div className="metric-value">{metrics?.repeat_customers || 0}</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-label">Pending Orders</div>
          <div className="metric-value">{metrics?.pending_orders || 0}</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-label">Pending Payments</div>
          <div className="metric-value">{metrics?.pending_payments || 0}</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-label">Pending Deliveries</div>
          <div className="metric-value">{metrics?.pending_deliveries || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">WhatsApp Orders</div>
          <div className="metric-value">{metrics?.whatsapp_orders || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Low Stock Items</div>
          <div className="metric-value">{metrics?.low_stock_count || 0}</div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Sales Over Time</h3>
          <table className="data-table">
            <thead><tr><th>Period</th><th>Orders</th><th>Revenue</th><th>Discounts</th></tr></thead>
            <tbody>
              {salesData.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.period).toLocaleDateString()}</td>
                  <td>{row.orders}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td>{formatCurrency(row.discounts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <h3>Orders Over Time</h3>
          <table className="data-table">
            <thead><tr><th>Period</th><th>Completed</th><th>Pending</th><th>Cancelled</th></tr></thead>
            <tbody>
              {ordersData.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.period).toLocaleDateString()}</td>
                  <td>{row.completed}</td>
                  <td>{row.pending}</td>
                  <td>{row.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <h3>B2C vs B2B Sales</h3>
          <table className="data-table">
            <thead><tr><th>Type</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>
              {b2cB2b.map((row, i) => (
                <tr key={i}>
                  <td>{row.customer_type?.toUpperCase() || 'Unknown'}</td>
                  <td>{row.orders}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
