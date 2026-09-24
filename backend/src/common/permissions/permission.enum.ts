// Central catalog of permission strings (Phase 12 — Authentication, RBAC &
// authorization hardening). Roles carry a subset of these in Role.permissions
// (JSON string array); a user's effective permissions are the union of every
// role assigned to them (see JwtStrategy). '*' on a role means "all
// permissions" and is reserved for the system-seeded "owner" role.

export enum Permission {
  PRODUCTS_READ = 'products.read',
  PRODUCTS_WRITE = 'products.write',

  INVENTORY_READ = 'inventory.read',
  INVENTORY_ADJUST = 'inventory.adjust',

  SALES_READ = 'sales.read',
  SALES_CREATE = 'sales.create',

  POS_OPEN = 'pos.open',
  POS_CLOSE = 'pos.close',

  REPORTS_READ = 'reports.read',

  USERS_MANAGE = 'users.manage',
  OUTLETS_MANAGE = 'outlets.manage',

  WHATSAPP_MANAGE = 'whatsapp.manage',
  WHATSAPP_SEND = 'whatsapp.send',

  SUBSCRIPTION_MANAGE = 'subscription.manage',
}

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

// Wildcard permission string a role can hold to mean "all of the above,
// including any added later." Kept separate from the enum since it isn't a
// concrete permission itself.
export const WILDCARD_PERMISSION = '*';

export function hasPermission(userPermissions: string[] | undefined, required: Permission): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  return userPermissions.includes(WILDCARD_PERMISSION) || userPermissions.includes(required);
}
