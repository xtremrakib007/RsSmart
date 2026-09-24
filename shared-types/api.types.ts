// Shared TypeScript types for all clients

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    roles: string[];
  };
}

export interface SyncEvent {
  eventId: string;
  clientId: string;
  timestamp: string;
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  vectorClock: Record<string, number>;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  basePrice: number;
  costPrice?: number;
  taxRate: number;
  isActive: boolean;
  trackInventory: boolean;
  attributes?: Record<string, any>;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface OrderRequest {
  customerId: string;
  source: 'SALES_APP' | 'ERP' | 'POS';
  items: OrderItem[];
  discount?: number;
  notes?: string;
  deliveryDate?: string;
}
