// Phase 37 field sales: pure helpers (distance, roles, attendance status,
// selfie decoding). Tested in field-sales.util.spec.ts.

/** Roles that manage the field team (assign customers and routes, see the team). */
export const MANAGER_ROLES = ['owner', 'admin', 'manager'];

/** Owner or admin: may change company-wide settings. */
export function isAdmin(roles: string[] | undefined): boolean {
  return (roles || []).some((r) => r === 'owner' || r === 'admin');
}

export function isManager(roles: string[] | undefined): boolean {
  return (roles || []).some((r) => MANAGER_ROLES.includes(r));
}

/** Great-circle distance in km between two points (Haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Customers nearest first from (lat, lng). Customers without a pinned
 * location come last (distanceKm null), by name.
 */
export function sortByDistance<T extends { latitude?: unknown; longitude?: unknown; name?: string }>(
  customers: T[], lat: number, lng: number, limit = 50,
): (T & { distanceKm: number | null })[] {
  return customers
    .map((c) => {
      const cl = num(c.latitude), cg = num(c.longitude);
      const distanceKm = cl === null || cg === null ? null : Math.round(haversineKm(lat, lng, cl, cg) * 100) / 100;
      return { ...c, distanceKm };
    })
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return String(a.name || '').localeCompare(String(b.name || ''));
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, Math.max(1, Math.min(limit, 500)));
}

export type AttendanceStatus = 'NOT_IN' | 'IN' | 'OUT';

export function attendanceStatus(rec: { checkInAt?: Date | null; checkOutAt?: Date | null } | null | undefined): AttendanceStatus {
  if (!rec || !rec.checkInAt) return 'NOT_IN';
  return rec.checkOutAt ? 'OUT' : 'IN';
}

/** Minutes worked (to now while still checked in). */
export function minutesWorked(rec: { checkInAt?: Date | null; checkOutAt?: Date | null } | null | undefined, now = new Date()): number {
  if (!rec || !rec.checkInAt) return 0;
  const end = rec.checkOutAt || now;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(rec.checkInAt).getTime()) / 60000));
}

/** Start of the given day (server time), as the attendance work date. */
export function workDateOf(d: Date | string = new Date()): Date {
  const w = new Date(d);
  w.setHours(0, 0, 0, 0);
  return w;
}

export const MAX_SELFIE_BYTES = 1.5 * 1024 * 1024;

/**
 * A selfie sent as a data URL ("data:image/jpeg;base64,…") as an uploadable
 * file, or null when none was sent. Only JPEG/PNG/WebP up to 1.5 MB.
 */
export function decodeSelfie(dataUrl: unknown, name: string):
  { buffer: Buffer; mimetype: string; originalname: string; size: number } | null {
  if (dataUrl === undefined || dataUrl === null || dataUrl === '') return null;
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl));
  if (!m) throw new Error('Photo must be a JPEG, PNG or WebP image.');
  const buffer = Buffer.from(m[3].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('Photo is empty.');
  if (buffer.length > MAX_SELFIE_BYTES) throw new Error('Photo is too large (max 1.5 MB).');
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  return { buffer, mimetype: m[1], originalname: `${name}.${ext}`, size: buffer.length };
}

/** Customers a user may work with: managers all, a rep their own and unassigned ones. */
export function customerScope(userId: string, roles: string[] | undefined): Record<string, unknown> {
  if (isManager(roles)) return {};
  return { OR: [{ assignedRepId: userId }, { assignedRepId: null }] };
}
