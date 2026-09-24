import { query } from '../database/connection.js';

/**
 * Extract business_id from X-Business-ID header or query param.
 * Validate that the authenticated user belongs to this business.
 * Attach business context to req.businessContext.
 *
 * SECURITY: This is the CRITICAL tenant isolation gate.
 * Every request involving business data MUST pass through this middleware.
 */
export const requireBusinessContext = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  const businessId = req.headers['x-business-id'] || req.query.businessId;

  if (!businessId) {
    return res.status(400).json({
      success: false,
      message: 'Business context required. Provide X-Business-ID header.'
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(businessId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid business ID format.'
    });
  }

  // Check if user belongs to this business
  const membership = req.user.businesses.find(b => b.business_id === businessId);

  if (!membership) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have access to this business.'
    });
  }

  // Load business details
  const bizResult = await query(
    'SELECT id, name, slug, status, currency, timezone FROM businesses WHERE id = $1',
    [businessId]
  );

  if (bizResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Business not found.'
    });
  }

  const business = bizResult.rows[0];

  if (business.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Business is not active.'
    });
  }

  // Attach business context to request
  req.businessContext = {
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    currency: business.currency,
    timezone: business.timezone,
    roleId: membership.role_id,
    roleName: membership.role_name
  };

  next();
};

/**
 * Optional business context - attaches if available but doesn't fail if missing.
 * Useful for routes that can work with or without business context.
 */
export const optionalBusinessContext = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const businessId = req.headers['x-business-id'] || req.query.businessId;

  if (!businessId) {
    return next();
  }

  const membership = req.user.businesses.find(b => b.business_id === businessId);

  if (!membership) {
    return next();
  }

  const bizResult = await query(
    'SELECT id, name, slug, status, currency, timezone FROM businesses WHERE id = $1',
    [businessId]
  );

  if (bizResult.rows.length === 0) {
    return next();
  }

  const business = bizResult.rows[0];

  if (business.status === 'active') {
    req.businessContext = {
      businessId: business.id,
      businessName: business.name,
      businessSlug: business.slug,
      currency: business.currency,
      timezone: business.timezone,
      roleId: membership.role_id,
      roleName: membership.role_name
    };
  }

  next();
};
