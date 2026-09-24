import { create } from 'zustand';
import type {
  Product, InventoryMovement, PurchaseOrder, ChartOfAccount,
  JournalEntry, User, AuditLog, ApprovalWorkflow, ReportFilter, SyncHealth
} from '@/types';

interface ErpState {
  // Data
  products: Product[];
  movements: InventoryMovement[];
  purchaseOrders: PurchaseOrder[];
  accounts: ChartOfAccount[];
  journals: JournalEntry[];
  users: User[];
  auditLogs: AuditLog[];
  approvals: ApprovalWorkflow[];
  syncHealth: SyncHealth[];

  // UI State
  selectedProduct: Product | null;
  selectedOrder: PurchaseOrder | null;
  selectedJournal: JournalEntry | null;
  reportFilter: ReportFilter;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProducts: (products: Product[]) => void;
  setMovements: (movements: InventoryMovement[]) => void;
  setPurchaseOrders: (orders: PurchaseOrder[]) => void;
  setAccounts: (accounts: ChartOfAccount[]) => void;
  setJournals: (journals: JournalEntry[]) => void;
  setUsers: (users: User[]) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  setApprovals: (approvals: ApprovalWorkflow[]) => void;
  setSyncHealth: (health: SyncHealth[]) => void;
  setSelectedProduct: (p: Product | null) => void;
  setSelectedOrder: (o: PurchaseOrder | null) => void;
  setSelectedJournal: (j: JournalEntry | null) => void;
  setReportFilter: (f: Partial<ReportFilter>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  lowStockProducts: () => Product[];
  pendingApprovals: () => ApprovalWorkflow[];
  totalRevenue: () => number;
  totalExpenses: () => number;
}

export const useErpStore = create<ErpState>((set, get) => ({
  products: [],
  movements: [],
  purchaseOrders: [],
  accounts: [],
  journals: [],
  users: [],
  auditLogs: [],
  approvals: [],
  syncHealth: [],

  selectedProduct: null,
  selectedOrder: null,
  selectedJournal: null,
  reportFilter: { dateFrom: null, dateTo: null, entityType: null, status: null, userId: null },
  isLoading: false,
  error: null,

  setProducts: (products) => set({ products }),
  setMovements: (movements) => set({ movements }),
  setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
  setAccounts: (accounts) => set({ accounts }),
  setJournals: (journals) => set({ journals }),
  setUsers: (users) => set({ users }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setApprovals: (approvals) => set({ approvals }),
  setSyncHealth: (syncHealth) => set({ syncHealth }),
  setSelectedProduct: (selectedProduct) => set({ selectedProduct }),
  setSelectedOrder: (selectedOrder) => set({ selectedOrder }),
  setSelectedJournal: (selectedJournal) => set({ selectedJournal }),
  setReportFilter: (filter) => set({ reportFilter: { ...get().reportFilter, ...filter } }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  lowStockProducts: () => get().products.filter(p => p.stockQuantity <= p.reorderLevel),
  pendingApprovals: () => get().approvals.filter(a => a.status === 'PENDING'),
  totalRevenue: () => get().accounts.filter(a => a.type === 'REVENUE').reduce((s, a) => s + a.balance, 0),
  totalExpenses: () => get().accounts.filter(a => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0),
}));
