import { body, param, query as q, validationResult } from 'express-validator';

export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array()
    });
  };
};

export const validateUUID = (field, location = 'param') => {
  const validator = location === 'param' ? param(field) : location === 'query' ? q(field) : body(field);
  return validator.isUUID().withMessage(`${field} must be a valid UUID.`);
};

export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim().replace(/[<>]/g, '');
      }
    }
  }
  next();
};
