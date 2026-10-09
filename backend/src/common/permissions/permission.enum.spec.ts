import { hasPermission, Permission, WILDCARD_PERMISSION } from './permission.enum';

describe('hasPermission', () => {
  it('rejects missing and empty permission sets', () => {
    expect(hasPermission(undefined, Permission.PRODUCTS_READ)).toBe(false);
    expect(hasPermission([], Permission.PRODUCTS_READ)).toBe(false);
  });

  it('allows an exact permission grant', () => {
    expect(hasPermission(['products.read'], Permission.PRODUCTS_READ)).toBe(true);
    expect(hasPermission(['products.write'], Permission.PRODUCTS_READ)).toBe(false);
  });

  it('allows the explicit all-permissions grant', () => {
    expect(hasPermission([WILDCARD_PERMISSION], Permission.REPORTS_READ)).toBe(true);
  });

  it('allows namespace wildcards only within their namespace', () => {
    expect(hasPermission(['products.*'], Permission.PRODUCTS_READ)).toBe(true);
    expect(hasPermission(['products.*'], Permission.PRODUCTS_WRITE)).toBe(true);
    expect(hasPermission(['products.*'], Permission.REPORTS_READ)).toBe(false);
    expect(hasPermission(['reports.*'], Permission.REPORTS_READ)).toBe(true);
  });

  it('does not treat malformed or non-string grants as permissions', () => {
    expect(hasPermission(['product.*'], Permission.PRODUCTS_READ)).toBe(false);
    expect(hasPermission(['* '], Permission.PRODUCTS_READ)).toBe(false);
    expect(hasPermission([null as any, 12 as any], Permission.PRODUCTS_READ)).toBe(false);
  });
});
