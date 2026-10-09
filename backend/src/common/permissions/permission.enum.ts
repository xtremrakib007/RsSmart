// Central catalog of permission strings (Phase 12 — Authentication, RBAC &
// authorization hardening). Roles carry a subset of these in Role.permissions
// (JSON string array); a user's effective permissions are the union of every
// role assigned to them (see JwtStrategy). '*' on a role means "all
// permissions" and is reserved for the system-seeded "owner" role.

export enum Permission {
  PRODUCTS_READ = 'products.read',
  PRODUCTS_WRITE = 'products.write',

  CUSTOMERS_READ = 'customers.read',
  CUSTOMERS_WRITE = 'customers.write',

  INVENTORY_READ = 'inventory.read',
  INVENTORY_ADJUST = 'inventory.adjust',

  SALES_READ = 'sales.read',
  SALES_CREATE = 'sales.create',

  POS_OPEN = 'pos.open',
  POS_CLOSE = 'pos.close',

  REPORTS_READ = 'reports.read',

  USERS_READ = 'users.read',
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
  if (userPermissions.includes(WILDCARD_PERMISSION) || userPermissions.includes(required)) return true;
  const requiredNamespace = required.split('.')[0];
  // Backward-compatible aliases for permission names already present in seeded
  // roles. Keep this explicit; never infer broad grants across unrelated areas.
  const legacyNamespaces: Record<string, string[]> = {
    sales: ['orders'],
  };
  const acceptedNamespaces = [requiredNamespace, ...(legacyNamespaces[requiredNamespace] ?? [])];
  const requiredAction = required.split('.')[1];

  return userPermissions.some((grant) => {
    if (typeof grant !== 'string') return false;
    if (grant.endsWith('.*')) {
      return acceptedNamespaces.includes(grant.slice(0, -2));
    }
    const [grantNamespace, grantAction] = grant.split('.');
    return acceptedNamespaces.includes(grantNamespace) &&
      grantAction === requiredAction &&
      grant.split('.').length === 2;
  });
}
