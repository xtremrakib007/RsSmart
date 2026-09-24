import { query } from '../database/connection.js';

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.businessContext) {
      return res.status(403).json({
        success: false,
        message: 'Business context required.'
      });
    }
    if (!allowedRoles.includes(req.businessContext.roleName)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`
      });
    }
    next();
  };
};

export const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.businessContext) {
      return res.status(403).json({
        success: false,
        message: 'Business context required.'
      });
    }
    const { roleId } = req.businessContext;
    const result = await query(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    const userPermissions = result.rows.map(r => r.name);
    const hasAll = requiredPermissions.every(p => userPermissions.includes(p));
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

export const requireBusinessAndRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.businessContext) {
      return res.status(403).json({
        success: false,
        message: 'Business context required.'
      });
    }
    if (roles.length > 0 && !roles.includes(req.businessContext.roleName)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
};
