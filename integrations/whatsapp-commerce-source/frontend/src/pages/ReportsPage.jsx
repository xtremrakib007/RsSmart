import { useState, useEffect } from 'react';
import api from '../services/api';
import './ReportsPage.css';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSalesReport = async () => {
    if (!range.startDate || !range.endDate) return;
    setLoading(true);
    try {
      const res = await api.get(`/analytics/sales-report?startDate=${range.startDate}&endDate=${range.endDate}`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/products?range=30days');
      setData(res.data.data.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerReport = async () => {
    setLoading(true);
    try {
      const [analytics, topCustomers] = await Promise.all([
        api.get('/analytics/customers?range=30days'),
        api.get('/analytics/top-customers?limit=20'),
      ]);
      setData({
        analytics: analytics.data.data,
        topCustomers: topCustomers.data.data.customers,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppReport = async () => {
    setLoading(true);
    try {
      const [analytics, funnel] = await Promise.all([
        api.get('/analytics/whatsapp?range=30days'),
        api.get('/analytics/whatsapp-funnel?range=30days'),
      ]);
      setData({
        analytics: analytics.data.data,
        funnel: funnel.data.data.funnel,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') fetchSalesReport();
    if (activeTab === 'products') fetchProductReport();
    if (activeTab === 'customers') fetchCustomerReport();
    if (activeTab === 'whatsapp') fetchWhatsAppReport();
  }, [activeTab]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(val || 0);

  const exportCSV = () => {
    if (!data) return;
    let csv = '';
    if (activeTab === 'sales' && data) {
      csv = 'Metric,Value\n';
      csv += `Gross Sales,${data.gross_sales}\n`;
      csv += `Discounts,${data.discounts}\n`;
      csv += `Delivery Fees,${data.delivery_fees}\n`;
      csv += `Refunds,${data.refunds}\n`;
      csv += `Net Sales,${data.net_sales}\n`;
      csv += `Order Count,${data.order_count}\n`;
      csv += `Avg Order Value,${data.avg_order_value}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_report.csv`;
    a.click();
  };

  return (
    <div className="reports-page">
      <h1>Reports</h1>
      <div className="tabs">
        {['sales', 'products', 'customers', 'whatsapp'].map(tab => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'sales' && (
        <div className="date-filter">
          <input type="date" value={range.startDate} onChange={e => setRange({ ...range, startDate: e.target.value })} />
          <input type="date" value={range.endDate} onChange={e => setRange({ ...range, endDate: e.target.value })} />
          <button onClick={fetchSalesReport}>Generate</button>
        </div>
      )}

      <button className="export-btn" onClick={exportCSV} disabled={!data}>Export CSV</button>

      {loading && <div className="loading">Loading...</div>}

      {activeTab === 'sales' && data && (
        <div className="report-table">
          <table>
            <tbody>
              <tr><td>Gross Sales</td><td>{formatCurrency(data.gross_sales)}</td></tr>
              <tr><td>Discounts</td><td>{formatCurrency(data.discounts)}</td></tr>
              <tr><td>Delivery Fees</td><td>{formatCurrency(data.delivery_fees)}</td></tr>
              <tr><td>Refunds</td><td>{formatCurrency(data.refunds)}</td></tr>
              <tr><td><strong>Net Sales</strong></td><td><strong>{formatCurrency(data.net_sales)}</strong></td></tr>
              <tr><td>Order Count</td><td>{data.order_count}</td></tr>
              <tr><td>Avg Order Value</td><td>{formatCurrency(data.avg_order_value)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'products' && data && (
        <table className="data-table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Sold</th><th>Revenue</th><th>Stock</th></tr>
          </thead>
          <tbody>
            {data.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.quantity_sold}</td>
                <td>{formatCurrency(p.revenue)}</td>
                <td>{p.stock_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'customers' && data && (
        <>
          <div className="metrics-row">
            <div className="metric-box">New: {data.analytics.new_customers}</div>
            <div className="metric-box">Returning: {data.analytics.returning_customers}</div>
            <div className="metric-box">B2B: {data.analytics.b2b_customers}</div>
            <div className="metric-box">Inactive: {data.analytics.inactive_customers}</div>
          </div>
          <h3>Top Customers</h3>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Orders</th><th>Total Spent</th></tr></thead>
            <tbody>
              {data.topCustomers.map(c => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>{c.total_orders}</td>
                  <td>{formatCurrency(c.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === 'whatsapp' && data && (
        <>
          <div className="metrics-row">
            <div className="metric-box">Messages In: {data.analytics.messages_received}</div>
            <div className="metric-box">Messages Out: {data.analytics.messages_sent}</div>
            <div className="metric-box">Conversations: {data.analytics.conversations}</div>
            <div className="metric-box">WhatsApp Orders: {data.analytics.whatsapp_orders}</div>
          </div>
          <h3>Sales Funnel</h3>
          <table className="data-table">
            <thead><tr><th>Event</th><th>Count</th></tr></thead>
            <tbody>
              {data.funnel.map(f => (
                <tr key={f.event_type}>
                  <td>{f.event_type}</td>
                  <td>{f.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
