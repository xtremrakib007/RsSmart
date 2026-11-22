import {
  DEFAULT_SALES_APP_CONFIG, applySalesAppConfigPatch, mergeSalesAppConfig, sanitizeSalesAppConfigPatch, updateStatus,
} from './app-config.util';

describe('sales app settings', () => {
  it('nothing saved: the defaults', () => {
    expect(mergeSalesAppConfig(undefined)).toEqual(DEFAULT_SALES_APP_CONFIG);
    expect(mergeSalesAppConfig('junk')).toEqual(DEFAULT_SALES_APP_CONFIG);
  });

  it('saved settings override the defaults; a broken saved value falls back alone', () => {
    const cfg = mergeSalesAppConfig({
      features: { expenses: false }, menuOrder: ['orders', 'customers'], currency: 'RM ', nearbyLimit: 9999,
      notice: { level: 'bogus', text: 'x' },
    });
    expect(cfg.features.expenses).toBe(false);
    expect(cfg.features.orders).toBe(true);
    expect(cfg.menuOrder.slice(0, 3)).toEqual(['orders', 'customers', 'attendance']);
    expect(cfg.menuOrder).toHaveLength(DEFAULT_SALES_APP_CONFIG.menuOrder.length);
    expect(cfg.currency).toBe('RM');
    expect(cfg.nearbyLimit).toBe(500);
    expect(cfg.notice).toEqual(DEFAULT_SALES_APP_CONFIG.notice);
  });

  it('refuses bad changes with a readable message', () => {
    expect(() => sanitizeSalesAppConfigPatch(null)).toThrow(/object/);
    expect(() => sanitizeSalesAppConfigPatch({ features: { payroll: true } })).toThrow(/Unknown feature "payroll"/);
    expect(() => sanitizeSalesAppConfigPatch({ features: { orders: 'yes' } })).toThrow(/true or false/);
    expect(() => sanitizeSalesAppConfigPatch({ update: { apkUrl: 'http://x/app.apk' } })).toThrow(/https/);
    expect(() => sanitizeSalesAppConfigPatch({ supportPhone: 'call me' })).toThrow(/phone/);
    expect(() => sanitizeSalesAppConfigPatch({ notice: { level: 'red' } })).toThrow(/info, warning or urgent/);
  });

  it('keeps only known keys', () => {
    expect(sanitizeSalesAppConfigPatch({ hack: 1, attendance: { selfieRequired: true, admin: true } }))
      .toEqual({ attendance: { selfieRequired: true } });
  });

  it('a change merges into what is saved, section by section', () => {
    const saved = { features: { expenses: false }, attendance: { gpsRequired: true }, other: 1 };
    const next = applySalesAppConfigPatch(saved, sanitizeSalesAppConfigPatch({ features: { visits: false }, attendance: { selfieRequired: true } }));
    expect(next).toEqual({ features: { expenses: false, visits: false }, attendance: { gpsRequired: true, selfieRequired: true }, other: 1 });
  });

  it('update prompts by version code', () => {
    const cfg = mergeSalesAppConfig({ update: { latestVersionCode: 5, minVersionCode: 3, apkUrl: 'https://files/app.apk' } });
    expect(updateStatus(cfg, 2)).toBe('REQUIRED');
    expect(updateStatus(cfg, 4)).toBe('AVAILABLE');
    expect(updateStatus(cfg, 5)).toBe('NONE');
    expect(updateStatus(cfg, undefined)).toBe('NONE');
    expect(updateStatus(mergeSalesAppConfig({ update: { minVersionCode: 9 } }), 1)).toBe('NONE'); // no APK link, no prompt
  });
});
