import { invoke } from '@tauri-apps/api/core';
import type {
  Product, InventoryMovement, PurchaseOrder, ChartOfAccount,
  JournalEntry, User, AuditLog, ApprovalWorkflow, ReportFilter, SyncHealth
} from '@/types';

// Products & Inventory
export const getProducts = (): Promise<Product[]> => invoke('get_products');
export const getProduct = (id: string): Promise<Product | null> => invoke('get_product', { id });
export const saveProduct = (product: Product): Promise<void> => invoke('save_product', { product });
export const deleteProduct = (id: string): Promise<void> => invoke('delete_product', { id });
export const getInventoryMovements = (productId?: string): Promise<InventoryMovement[]> =>
  invoke('get_inventory_movements', { productId });
export const recordMovement = (movement: InventoryMovement): Promise<void> =>
  invoke('record_movement', { movement });

// Purchase Orders
export const getPurchaseOrders = (): Promise<PurchaseOrder[]> => invoke('get_purchase_orders');
export const getPurchaseOrder = (id: string): Promise<PurchaseOrder | null> => invoke('get_purchase_order', { id });
export const createPurchaseOrder = (order: PurchaseOrder): Promise<void> => invoke('create_purchase_order', { order });
export const updatePoStatus = (id: string, status: string): Promise<void> =>
  invoke('update_po_status', { id, status });

// Accounting
export const getChartOfAccounts = (): Promise<ChartOfAccount[]> => invoke('get_chart_of_accounts');
export const getJournalEntries = (filters?: ReportFilter): Promise<JournalEntry[]> =>
  invoke('get_journal_entries', { filters });
export const createJournalEntry = (entry: JournalEntry): Promise<void> =>
  invoke('create_journal_entry', { entry });
export const postJournalEntry = (id: string): Promise<void> => invoke('post_journal_entry', { id });

// Users / HR
export const getUsers = (): Promise<User[]> => invoke('get_users');
export const saveUser = (user: User): Promise<void> => invoke('save_user', { user });
export const deleteUser = (id: string): Promise<void> => invoke('delete_user', { id });

// Audit
export const getAuditLogs = (filters?: ReportFilter): Promise<AuditLog[]> =>
  invoke('get_audit_logs', { filters });

// Approvals
export const getApprovals = (): Promise<ApprovalWorkflow[]> => invoke('get_approvals');
export const approveRequest = (id: string, comments?: string): Promise<void> =>
  invoke('approve_request', { id, comments });
export const rejectRequest = (id: string, comments?: string): Promise<void> =>
  invoke('reject_request', { id, comments });

// Reports
export const generateReport = (type: string, filters: ReportFilter): Promise<string> =>
  invoke('generate_report', { type, filters });
export const exportToExcel = (type: string, filters: ReportFilter): Promise<string> =>
  invoke('export_to_excel', { type, filters });
export const exportToPdf = (type: string, filters: ReportFilter): Promise<string> =>
  invoke('export_to_pdf', { type, filters });

// Sync
export const getSyncHealth = (): Promise<SyncHealth[]> => invoke('get_sync_health');
export const triggerSync = (): Promise<void> => invoke('trigger_sync');

// Branding
export interface Branding {
  display_name: string;
  logo_url: string | null;
  primary_color: string | null;
}
export const getBranding = (): Promise<Branding> => invoke('get_branding');

// Dashboard KPIs
export const getDashboardKpis = (): Promise<{
  revenue: number;
  expenses: number;
  profit: number;
  salesCount: number;
  lowStockCount: number;
  pendingPoCount: number;
  pendingApprovalCount: number;
}> => invoke('get_dashboard_kpis');
