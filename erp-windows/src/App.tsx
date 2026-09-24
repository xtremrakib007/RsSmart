import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/components/dashboard/Dashboard';
import InventoryManager from '@/components/inventory/InventoryManager';
import PurchaseOrderManager from '@/components/purchasing/PurchaseOrderManager';
import AccountingModule from '@/components/accounting/AccountingModule';
import UserManager from '@/components/hr/UserManager';
import ReportBuilder from '@/components/reports/ReportBuilder';
import AuditLogViewer from '@/components/audit/AuditLogViewer';
import ApprovalWorkflow from '@/components/approvals/ApprovalWorkflow';
import SyncMonitor from '@/components/sync/SyncMonitor';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<InventoryManager />} />
        <Route path="purchasing" element={<PurchaseOrderManager />} />
        <Route path="accounting" element={<AccountingModule />} />
        <Route path="hr" element={<UserManager />} />
        <Route path="reports" element={<ReportBuilder />} />
        <Route path="audit" element={<AuditLogViewer />} />
        <Route path="approvals" element={<ApprovalWorkflow />} />
        <Route path="sync" element={<SyncMonitor />} />
      </Route>
    </Routes>
  );
}
