const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const productionOnly = ['REDIS_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (process.env.NODE_ENV === 'production') {
  missing.push(...productionOnly.filter((k) => !process.env[k]));
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if ((process.env[key] || '').length < 32) throw new Error(`${key} must be at least 32 characters in production`);
  }
  if (process.env.CORS_ORIGINS === '*') throw new Error('CORS_ORIGINS must not be * in production');
}
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
console.log('Environment validation passed.');
