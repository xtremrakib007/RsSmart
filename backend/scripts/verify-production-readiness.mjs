import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const required = [
  'src/auth', 'src/common/guards/tenant.guard.ts', 'src/whatsapp',
  'src/inventory', 'src/orders', 'src/pos-sessions', 'src/pos-transactions',
  'src/sync', 'src/health', 'prisma/schema.prisma', 'scripts/validate-env.mjs'
];
const forbiddenNames = ['.env', '.env.production', 'serviceAccountKey.json'];
const problems = [];
for (const item of required) if (!fs.existsSync(path.join(root, item))) problems.push(`Missing: ${item}`);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) walk(p);
    else if (entry.isFile() && forbiddenNames.includes(entry.name)) problems.push(`Secret file present: ${path.relative(root, p)}`);
  }
}
walk(root);
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
for (const model of ['Tenant','User','Product','Inventory','Order','Payment','PosSession','WhatsAppAccount','WhatsAppConversation','WhatsAppMessage','WhatsAppCampaign']) {
  if (!new RegExp(`^model\\s+${model}\\b`, 'm').test(schema)) problems.push(`Missing Prisma model: ${model}`);
}
const result = { ok: problems.length === 0, checked: required.length, problems, note: 'Static readiness check only; run npm test, npm run build, Prisma validation, Android/Windows builds, and load/security tests in CI.' };
console.log(JSON.stringify(result, null, 2));
process.exitCode = problems.length ? 1 : 0;
