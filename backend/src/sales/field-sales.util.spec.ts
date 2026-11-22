import {
  isAdmin, attendanceStatus, customerScope, decodeSelfie, haversineKm, isManager, minutesWorked, sortByDistance, workDateOf,
} from './field-sales.util';

describe('field sales helpers', () => {
  it('managers are admin or manager', () => {
    expect(isManager(['admin'])).toBe(true);
    expect(isManager(['sales_rep', 'manager'])).toBe(true);
    expect(isManager(['sales_rep'])).toBe(false);
    expect(isManager(undefined)).toBe(false);
  });

  it('a rep sees own and unassigned customers; managers see all', () => {
    expect(customerScope('rep-1', ['sales_rep'])).toEqual({ OR: [{ assignedRepId: 'rep-1' }, { assignedRepId: null }] });
    expect(customerScope('m-1', ['manager'])).toEqual({});
  });

  it('haversine distance', () => {
    // Ipoh to Kuala Lumpur, about 175 km in a straight line
    const km = haversineKm(4.5975, 101.0901, 3.139, 101.6869);
    expect(km).toBeGreaterThan(165);
    expect(km).toBeLessThan(185);
    expect(haversineKm(4.6, 101.1, 4.6, 101.1)).toBe(0);
  });

  it('sorts nearest first, unpinned last by name, and limits', () => {
    const list = sortByDistance([
      { id: 'far', name: 'Far', latitude: '3.139', longitude: '101.6869' },
      { id: 'none-b', name: 'B no pin', latitude: null, longitude: null },
      { id: 'near', name: 'Near', latitude: 4.6, longitude: 101.1 },
      { id: 'none-a', name: 'A no pin' },
    ], 4.5975, 101.0901, 10);
    expect(list.map((c) => c.id)).toEqual(['near', 'far', 'none-a', 'none-b']);
    expect(list[0].distanceKm).toBeLessThan(2);
    expect(list[2].distanceKm).toBeNull();
    expect(sortByDistance([{ name: 'a', latitude: 1, longitude: 1 }, { name: 'b', latitude: 2, longitude: 2 }], 1, 1, 1)).toHaveLength(1);
  });

  it('attendance status and minutes worked', () => {
    const t0 = new Date('2026-10-31T01:00:00Z');
    expect(attendanceStatus(null)).toBe('NOT_IN');
    expect(attendanceStatus({ checkInAt: t0 })).toBe('IN');
    expect(attendanceStatus({ checkInAt: t0, checkOutAt: new Date('2026-10-31T09:30:00Z') })).toBe('OUT');
    expect(minutesWorked({ checkInAt: t0, checkOutAt: new Date('2026-10-31T09:30:00Z') })).toBe(510);
    expect(minutesWorked({ checkInAt: t0 }, new Date('2026-10-31T02:00:00Z'))).toBe(60);
    expect(minutesWorked(null)).toBe(0);
  });

  it('work date is the start of the day', () => {
    const w = workDateOf(new Date(2026, 9, 31, 15, 20));
    expect([w.getHours(), w.getMinutes(), w.getDate()]).toEqual([0, 0, 31]);
  });

  it('decodes a selfie data URL and rejects bad ones', () => {
    const png = 'data:image/png;base64,' + Buffer.from('fake-image').toString('base64');
    const f = decodeSelfie(png, 'u1-in')!;
    expect(f.mimetype).toBe('image/png');
    expect(f.originalname).toBe('u1-in.png');
    expect(f.buffer.toString()).toBe('fake-image');
    expect(decodeSelfie(undefined, 'x')).toBeNull();
    expect(decodeSelfie('', 'x')).toBeNull();
    expect(() => decodeSelfie('data:text/html;base64,PGh0bWw+', 'x')).toThrow(/JPEG, PNG or WebP/);
    expect(() => decodeSelfie('data:image/jpeg;base64,' + Buffer.alloc(2 * 1024 * 1024).toString('base64'), 'x')).toThrow(/too large/);
  });
});

describe('owner', () => {
  it('the company owner counts as manager and admin', () => {
    expect(isManager(['owner'])).toBe(true);
    expect(isAdmin(['owner'])).toBe(true);
    expect(isAdmin(['manager'])).toBe(false);
  });
});
