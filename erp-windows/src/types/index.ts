export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitPrice: number;
  costPrice: number | null;
  taxRate: number;
  stockQuantity: number;
  reorderLevel: number;
  unitOfMeasure: string;
  isActive: boolean;
  tenantId: string;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  unitCost: number;
  totalCost: number;
  reference: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  expectedDelivery: number | null;
  receivedAt: number | null;
  items: PurchaseOrderItem[];
  createdBy: string;
  createdAt: number;
  approvedBy: string | null;
  approvedAt: number | null;
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId: string | null;
  balance: number;
  isActive: boolean;
  tenantId: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: number;
  reference: string | null;
  description: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  lines: JournalLine[];
  createdBy: string;
  createdAt: number;
  postedAt: number | null;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'INVENTORY' | 'ACCOUNTANT';
  isActive: boolean;
  lastLogin: number | null;
  createdAt: number;
  permissions: string[];
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'APPROVE';
  oldValues: string | null;
  newValues: string | null;
  performedBy: string;
  performedByName: string;
  ipAddress: string | null;
  timestamp: number;
}

export interface ApprovalWorkflow {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId: string | null;
  approverName: string | null;
  approvedAt: number | null;
  comments: string | null;
}

export interface KpiWidget {
  title: string;
  value: number | string;
  change: number;
  changeType: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

export interface ReportFilter {
  dateFrom: number | null;
  dateTo: number | null;
  entityType: string | null;
  status: string | null;
  userId: string | null;
}

export interface SyncHealth {
  deviceId: string;
  deviceName: string;
  lastSync: number | null;
  pendingCount: number;
  failedCount: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  latencyMs: number;
}
