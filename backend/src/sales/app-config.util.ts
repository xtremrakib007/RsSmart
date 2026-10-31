// Sales app settings an admin changes on the server, with no app rebuild:
// which menu tiles show, attendance rules, a notice on the dashboard,
// currency, support contact and app-update prompts. Stored per tenant in
// tenants.settings.salesApp. Tested in app-config.util.spec.ts.

/** Dashboard tiles the app knows; the server turns each on or off. */
export const SALES_APP_FEATURES = [
  'attendance', 'today', 'nearby', 'team', 'customers', 'orders', 'visits', 'collections', 'expenses', 'sync',
] as const;
export type SalesAppFeature = (typeof SALES_APP_FEATURES)[number];

export interface SalesAppConfig {
  features: Record<SalesAppFeature, boolean>;
  /** Tile order; features left out keep their default place after these. */
  menuOrder: SalesAppFeature[];
  attendance: { selfieRequired: boolean; gpsRequired: boolean };
  nearbyLimit: number;
  currency: string;
  supportPhone: string;
  notice: { text: string; level: 'info' | 'warning' | 'urgent' };
  update: { latestVersionCode: number; minVersionCode: number; apkUrl: string; notes: string };
}

export const DEFAULT_SALES_APP_CONFIG: SalesAppConfig = {
  features: Object.fromEntries(SALES_APP_FEATURES.map((f) => [f, true])) as Record<SalesAppFeature, boolean>,
  menuOrder: [...SALES_APP_FEATURES],
  attendance: { selfieRequired: false, gpsRequired: false },
  nearbyLimit: 50,
  currency: 'RM',
  supportPhone: '',
  notice: { text: '', level: 'info' },
  update: { latestVersionCode: 0, minVersionCode: 0, apkUrl: '', notes: '' },
};

const NOTICE_LEVELS = ['info', 'warning', 'urgent'];
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const int = (v: unknown, min: number, max: number) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

/**
 * Checks a change an admin sends and keeps only known keys with valid values.
 * Throws with a readable message on a bad value, so nothing broken is saved.
 */
export function sanitizeSalesAppConfigPatch(patch: unknown): Partial<SalesAppConfig> {
  if (!isObj(patch)) throw new Error('Settings must be an object.');
  const out: any = {};
  if (patch.features !== undefined) {
    if (!isObj(patch.features)) throw new Error('features must be an object of true/false.');
    out.features = {};
    for (const [k, v] of Object.entries(patch.features)) {
      if (!(SALES_APP_FEATURES as readonly string[]).includes(k)) throw new Error(`Unknown feature "${k}".`);
      if (typeof v !== 'boolean') throw new Error(`features.${k} must be true or false.`);
      out.features[k] = v;
    }
  }
  if (patch.menuOrder !== undefined) {
    if (!Array.isArray(patch.menuOrder)) throw new Error('menuOrder must be a list.');
    const seen = new Set<string>();
    for (const k of patch.menuOrder) {
      if (!(SALES_APP_FEATURES as readonly string[]).includes(k)) throw new Error(`Unknown feature "${k}" in menuOrder.`);
      seen.add(k);
    }
    out.menuOrder = [...seen];
  }
  if (patch.attendance !== undefined) {
    if (!isObj(patch.attendance)) throw new Error('attendance must be an object.');
    out.attendance = {};
    for (const k of ['selfieRequired', 'gpsRequired']) {
      if (patch.attendance[k] === undefined) continue;
      if (typeof patch.attendance[k] !== 'boolean') throw new Error(`attendance.${k} must be true or false.`);
      out.attendance[k] = patch.attendance[k];
    }
  }
  if (patch.nearbyLimit !== undefined) {
    const n = int(patch.nearbyLimit, 5, 500);
    if (n === null) throw new Error('nearbyLimit must be a number.');
    out.nearbyLimit = n;
  }
  if (patch.currency !== undefined) {
    const c = str(patch.currency, 5);
    if (!c) throw new Error('currency cannot be empty.');
    out.currency = c;
  }
  if (patch.supportPhone !== undefined) {
    const p = str(patch.supportPhone, 20);
    if (p && !/^\+?[0-9 -]{6,20}$/.test(p)) throw new Error('supportPhone must be a phone number.');
    out.supportPhone = p;
  }
  if (patch.notice !== undefined) {
    if (!isObj(patch.notice)) throw new Error('notice must be an object.');
    out.notice = {};
    if (patch.notice.text !== undefined) out.notice.text = str(patch.notice.text, 500);
    if (patch.notice.level !== undefined) {
      if (!NOTICE_LEVELS.includes(patch.notice.level)) throw new Error('notice.level must be info, warning or urgent.');
      out.notice.level = patch.notice.level;
    }
  }
  if (patch.update !== undefined) {
    if (!isObj(patch.update)) throw new Error('update must be an object.');
    out.update = {};
    for (const k of ['latestVersionCode', 'minVersionCode']) {
      if (patch.update[k] === undefined) continue;
      const n = int(patch.update[k], 0, 2_000_000_000);
      if (n === null) throw new Error(`update.${k} must be a number.`);
      out.update[k] = n;
    }
    if (patch.update.apkUrl !== undefined) {
      const u = str(patch.update.apkUrl, 500);
      if (u && !/^https:\/\//i.test(u)) throw new Error('update.apkUrl must start with https://');
      out.update.apkUrl = u;
    }
    if (patch.update.notes !== undefined) out.update.notes = str(patch.update.notes, 1000);
  }
  return out;
}

/** Stored settings over the defaults; anything stored that is no longer valid is ignored. */
export function mergeSalesAppConfig(stored: unknown): SalesAppConfig {
  const d = DEFAULT_SALES_APP_CONFIG;
  let p: Partial<SalesAppConfig> = {};
  if (isObj(stored)) {
    // Sanitize section by section, so one bad saved value does not drop the rest.
    for (const key of Object.keys(stored)) {
      try { Object.assign(p, sanitizeSalesAppConfigPatch({ [key]: stored[key] })); } catch { /* keep the default */ }
    }
  }
  const order = p.menuOrder || [];
  return {
    features: { ...d.features, ...(p.features || {}) },
    menuOrder: [...order, ...d.menuOrder.filter((f) => !order.includes(f))],
    attendance: { ...d.attendance, ...(p.attendance || {}) },
    nearbyLimit: p.nearbyLimit ?? d.nearbyLimit,
    currency: p.currency ?? d.currency,
    supportPhone: p.supportPhone ?? d.supportPhone,
    notice: { ...d.notice, ...(p.notice || {}) },
    update: { ...d.update, ...(p.update || {}) },
  };
}

/** Applies a sanitized change to what is stored (one level deep for sections). */
export function applySalesAppConfigPatch(stored: unknown, patch: Partial<SalesAppConfig>): Record<string, any> {
  const base: Record<string, any> = isObj(stored) ? { ...stored } : {};
  for (const [k, v] of Object.entries(patch)) {
    base[k] = isObj(v) && isObj(base[k]) ? { ...base[k], ...v } : v;
  }
  return base;
}

export type UpdateStatus = 'NONE' | 'AVAILABLE' | 'REQUIRED';

/** Whether the app at versionCode should offer, or force, an update. */
export function updateStatus(cfg: SalesAppConfig, versionCode: number | undefined): UpdateStatus {
  if (!versionCode || !Number.isFinite(versionCode) || !cfg.update.apkUrl) return 'NONE';
  if (versionCode < cfg.update.minVersionCode) return 'REQUIRED';
  if (versionCode < cfg.update.latestVersionCode) return 'AVAILABLE';
  return 'NONE';
}
