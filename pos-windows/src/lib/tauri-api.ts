import { invoke } from '@tauri-apps/api/core';
import { Product, PosSession, PosOrder, CartItem, Payment, OfflineQueueItem } from '@/types';

// Session API
export const openSession = (openingCash: number, notes?: string): Promise<PosSession> =>
  invoke('open_session', { openingCash, notes });

export const closeSession = (closingCash: number, notes?: string): Promise<void> =>
  invoke('close_session', { closingCash, notes });

export const getOpenSession = (): Promise<PosSession | null> =>
  invoke('get_open_session');

// Product API
export const getProducts = (): Promise<Product[]> =>
  invoke('get_products');

export const searchProducts = (query: string): Promise<Product[]> =>
  invoke('search_products', { query });

export const getProductByBarcode = (barcode: string): Promise<Product | null> =>
  invoke('get_product_by_barcode', { barcode });

// Order API
export const createOrder = (
  sessionId: string,
  items: CartItem[],
  customerName?: string
): Promise<PosOrder> =>
  invoke('create_order', { sessionId, items, customerName });

export const getOrdersBySession = (sessionId: string): Promise<PosOrder[]> =>
  invoke('get_orders_by_session', { sessionId });

// Payment API
export const recordPayment = (payment: Payment): Promise<void> =>
  invoke('record_payment', { payment });

// Refund API
export const processRefund = (receiptNumber: string, amount: number, reason?: string): Promise<void> =>
  invoke('process_refund', { receiptNumber, amount, reason });

// Sync API
export const getPendingSyncCount = (): Promise<number> =>
  invoke('get_pending_sync_count');

export const triggerSync = (): Promise<void> =>
  invoke('trigger_sync');

export const getOfflineQueue = (): Promise<OfflineQueueItem[]> =>
  invoke('get_offline_queue');

// Hardware API
export const printReceipt = (orderId: string): Promise<void> =>
  invoke('print_receipt', { orderId });

export const openCashDrawer = (): Promise<void> =>
  invoke('open_cash_drawer');

export const listPrinters = (): Promise<{ name: string; type: string }[]> =>
  invoke('list_printers');

export const getConnectedDevices = (): Promise<{ name: string; type: string; vendorId: number; productId: number }[]> =>
  invoke('get_connected_devices');

export const readScale = (): Promise<number> =>
  invoke('read_scale');

// Branding
export interface Branding {
  display_name: string;
  logo_url: string | null;
  primary_color: string | null;
}
export const getBranding = (): Promise<Branding> => invoke('get_branding');

// Auth API
export interface AuthStatus {
  tenant_id: string;
  user_id: string;
  email: string;
}
export const login = (email: string, password: string, tenantId: string): Promise<AuthStatus> =>
  invoke('login', { email, password, tenantId });
export const logout = (): Promise<void> => invoke('logout');
export const getAuthStatus = (): Promise<AuthStatus | null> => invoke('get_auth_status');
