const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((key) => !process.env[key]?.trim());
const isProduction = process.env.NODE_ENV === 'production';

const weakSecret = (value) => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized.length < 32 ||
    ['change-me', 'changeme', 'your-secret', 'secret', 'password', 'example'].some((part) => normalized.includes(part));
};

if (isProduction) {
  if (!process.env.REDIS_PASSWORD?.trim()) missing.push('REDIS_PASSWORD');
  if (!process.env.CORS_ORIGINS?.trim()) missing.push('CORS_ORIGINS');

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (weakSecret(process.env[key])) {
      throw new Error(`${key} must be a strong, non-placeholder secret of at least 32 characters in production`);
    }
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different in production');
  }

  const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must contain explicit HTTPS origins in production; wildcard is forbidden');
  }
  for (const origin of corsOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin configured: ${origin}`);
    }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new Error(`Production CORS origin must be a plain HTTPS origin without a path: ${origin}`);
    }
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('DATABASE_URL must use PostgreSQL in production');
  }
  if (/user:password|localhost:5432\/central_db|example/i.test(databaseUrl)) {
    throw new Error('DATABASE_URL appears to contain a development placeholder');
  }

  const port = process.env.PORT;
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
}

if (missing.length) {
  throw new Error(`Missing environment variables: ${[...new Set(missing)].join(', ')}`);
}
console.log('Environment validation passed.');
