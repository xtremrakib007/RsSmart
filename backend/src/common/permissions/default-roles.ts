import { Permission, WILDCARD_PERMISSION } from './permission.enum';

// Seeded once per new company at signup (see AuthService.registerCompany).
// Tenants are free to edit/add roles afterwards through the roles admin
// endpoints — these are just sane, working defaults so a new company isn't
// left with zero usable roles.
export interface DefaultRoleDefinition {
  name: string;
  description: string;
  isSystem: boolean;
  scopeAllOutlets: boolean;
  permissions: string[];
}

export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: 'owner',
    description: 'Company owner — full access to everything, all outlets.',
    isSystem: true,
    scopeAllOutlets: true,
    permissions: [WILDCARD_PERMISSION],
  },
  {
    name: 'admin',
    description: 'Company administrator — manages users, outlets and catalog, all outlets.',
    isSystem: true,
    scopeAllOutlets: true,
    permissions: [
      Permission.PRODUCTS_READ,
      Permission.PRODUCTS_WRITE,
      Permission.INVENTORY_READ,
      Permission.INVENTORY_ADJUST,
      Permission.SALES_READ,
      Permission.SALES_CREATE,
      Permission.POS_OPEN,
      Permission.POS_CLOSE,
      Permission.REPORTS_READ,
      Permission.USERS_MANAGE,
      Permission.OUTLETS_MANAGE,
      Permission.WHATSAPP_MANAGE,
      Permission.WHATSAPP_SEND,
    ],
  },
  {
    name: 'manager',
    description: 'Outlet manager — day-to-day operations at their assigned outlet(s).',
    isSystem: true,
    scopeAllOutlets: false,
    permissions: [
      Permission.PRODUCTS_READ,
      Permission.PRODUCTS_WRITE,
      Permission.INVENTORY_READ,
      Permission.INVENTORY_ADJUST,
      Permission.SALES_READ,
      Permission.SALES_CREATE,
      Permission.POS_OPEN,
      Permission.POS_CLOSE,
      Permission.REPORTS_READ,
    ],
  },
  {
    name: 'cashier',
    description: 'POS cashier — sells and opens/closes their own till at an assigned outlet.',
    isSystem: true,
    scopeAllOutlets: false,
    permissions: [
      Permission.PRODUCTS_READ,
      Permission.INVENTORY_READ,
      Permission.SALES_READ,
      Permission.SALES_CREATE,
      Permission.POS_OPEN,
      Permission.POS_CLOSE,
    ],
  },
];
