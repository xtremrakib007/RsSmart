import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permission.enum';

export const PERMISSIONS_KEY = 'permissions';

// A user needs ALL listed permissions (or the '*' wildcard) to pass. Use
// alongside or instead of @Roles(...) — permission checks are what the
// roadmap calls for; @Roles(...) is kept for the handful of existing
// call sites that haven't been migrated to explicit permissions yet.
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
