import { useState } from 'react';
import { exportToExcel, exportToPdf } from '@/lib/tauri-api';
import { FileSpreadsheet, FileText, Filter, Calendar } from 'lucide-react';
import type { ReportFilter } from '@/types';

const reportTypes = [
  { id: 'sales', name: 'Sales Report', desc: 'Revenue, transactions, trends' },
  { id: 'inventory', name: 'Inventory Report', desc: 'Stock levels, movements, valuation' },
  { id: 'purchase', name: 'Purchase Report', desc: 'POs, suppliers, costs' },
  { id: 'financial', name: 'Financial Report', desc: 'P&L, balance sheet, cash flow' },
  { id: 'audit', name: 'Audit Report', desc: 'Activity logs, changes, compliance' },
];

export default function ReportBuilder() {
  const [selectedType, setSelectedType] = useState('sales');
  const [filters, setFilters] = useState<ReportFilter>({ dateFrom: null, dateTo: null, entityType: null, status: null, userId: null });
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      if (format === 'excel') {
        await exportToExcel(selectedType, filters);
      } else {
        await exportToPdf(selectedType, filters);
      }
    } catch (e) {}
    setExporting(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Report Builder</h1>
        <p className="text-gray-500">Generate and export business reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Report Type Selection */}
        <div className="card space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> Select Report
          </h3>
          {reportTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedType === type.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className="font-medium text-sm">{type.name}</p>
              <p className="text-xs text-gray-500">{type.desc}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4" /> Filters
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> Date From</label>
                <input type="date" className="input" onChange={e => setFilters({ ...filters, dateFrom: new Date(e.target.value).getTime() })} />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> Date To</label>
                <input type="date" className="input" onChange={e => setFilters({ ...filters, dateTo: new Date(e.target.value).getTime() })} />
              </div>
              <div>
                <label className="text-sm font-medium">Entity Type</label>
                <select className="input" onChange={e => setFilters({ ...filters, entityType: e.target.value || null })}>
                  <option value="">All</option>
                  <option value="ORDER">Orders</option>
                  <option value="PRODUCT">Products</option>
                  <option value="PAYMENT">Payments</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="input" onChange={e => setFilters({ ...filters, status: e.target.value || null })}>
                  <option value="">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Export</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('excel')}
                disabled={exporting === 'excel'}
                className="flex-1 btn-secondary h-12 flex items-center justify-center gap-2"
              >
                {exporting === 'excel' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                Export Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting === 'pdf'}
                className="flex-1 btn-accent h-12 flex items-center justify-center gap-2"
              >
                {exporting === 'pdf' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
