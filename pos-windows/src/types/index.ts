export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  unitPrice: number;
  costPrice: number | null;
  taxRate: number;
  stockQuantity: number;
  unitOfMeasure: string;
  isActive: boolean;
  imageUrl: string | null;
  tenantId: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'ERROR';
  lastModified: number;
  serverVersion: number;
}

export interface CartItem {
  id: number;
  sessionId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  notes: string | null;
}

export interface PosSession {
  id: string;
  tenantId: string;
  userId: string;
  deviceId: string;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  totalSales: number;
  totalRefunds: number;
  transactionCount: number;
  openedAt: number;
  closedAt: number | null;
  status: 'OPEN' | 'CLOSED' | 'SYNCING';
  notes: string | null;
  syncStatus: 'PENDING' | 'SYNCED';
}

export interface PosOrder {
  id: string;
  sessionId: string;
  receiptNumber: string;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  customerId: string | null;
  customerName: string | null;
  itemCount: number;
  status: 'COMPLETED' | 'REFUNDED' | 'PENDING';
  isOffline: boolean;
  createdAt: number;
  syncStatus: 'PENDING' | 'SYNCED';
  serverVersion: number;
}

export interface Payment {
  id: string;
  orderId: string;
  sessionId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'MOBILE' | 'SPLIT';
  cardLastFour: string | null;
  cardType: string | null;
  mobileProvider: string | null;
  mobileReference: string | null;
  isRefund: boolean;
  processedAt: number;
  syncStatus: 'PENDING' | 'SYNCED';
  receiptNumber: string | null;
}

export interface OfflineQueueItem {
  id: number;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  errorMessage: string | null;
  createdAt: number;
  lastAttempt: number | null;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE';

export interface SplitPayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}
