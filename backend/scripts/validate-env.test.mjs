import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = fileURLToPath(new URL('./validate-env.mjs', import.meta.url));
const baseEnv = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:long-random-password@db.example.com:5432/app',
  JWT_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  REDIS_PASSWORD: 'redis-' + 'r'.repeat(40),
  CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
};

function run(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...baseEnv, ...overrides },
  });
}

test('accepts valid production environment configuration', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('rejects short or placeholder JWT secrets', () => {
  const result = run({ JWT_SECRET: 'change-me' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET must be a strong/);
});

test('rejects reuse of access and refresh secrets', () => {
  const secret = 'same-secret-' + 'x'.repeat(32);
  const result = run({ JWT_SECRET: secret, JWT_REFRESH_SECRET: secret });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be different/);
});

test('rejects wildcard or non-HTTPS production CORS origins', () => {
  for (const origin of ['*', 'http://app.example.com', 'https://app.example.com/path']) {
    const result = run({ CORS_ORIGINS: origin });
    assert.notEqual(result.status, 0, `Expected rejection for ${origin}`);
  }
});

test('rejects placeholder or non-PostgreSQL database URLs', () => {
  for (const databaseUrl of [
    'postgresql://user:password@localhost:5432/central_db',
    'mysql://user:pass@db.example.com/app',
  ]) {
    const result = run({ DATABASE_URL: databaseUrl });
    assert.notEqual(result.status, 0, `Expected rejection for ${databaseUrl}`);
  }
});

test('requires Redis password and explicit CORS origins in production', () => {
  const missingRedis = run({ REDIS_PASSWORD: '' });
  assert.notEqual(missingRedis.status, 0);
  assert.match(missingRedis.stderr, /REDIS_PASSWORD/);

  const missingCors = run({ CORS_ORIGINS: '' });
  assert.notEqual(missingCors.status, 0);
  assert.match(missingCors.stderr, /CORS_ORIGINS/);
});
