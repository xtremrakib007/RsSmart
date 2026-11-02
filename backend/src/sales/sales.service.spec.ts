import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

describe('SalesService (Phase 37 field sales)', () => {
  let service: SalesService;
  let prisma: any;
  let upload: { uploadFile: jest.Mock; getFileUrl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      attendanceRecord: { findUnique: jest.fn(), upsert: jest.fn((a) => Promise.resolve({ id: 'a1', ...a.create })), update: jest.fn((a) => Promise.resolve({ id: 'a1', ...a.data })), findMany: jest.fn() },
      routePlan: { create: jest.fn((a) => Promise.resolve(a.data)), findMany: jest.fn() },
      customer: { findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 2 }), groupBy: jest.fn() },
      customerVisit: { findMany: jest.fn() },
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }), update: jest.fn().mockResolvedValue({}) },
    };
    upload = { uploadFile: jest.fn().mockResolvedValue('tenants/t1/attendance/x.jpg'), getFileUrl: jest.fn().mockResolvedValue('https://files/x.jpg') };
    const mod = await Test.createTestingModule({
      providers: [SalesService, { provide: PrismaService, useValue: prisma }, { provide: UploadService, useValue: upload }],
    }).compile();
    service = mod.get(SalesService);
  });

  const selfie = 'data:image/jpeg;base64,' + Buffer.from('jpeg-bytes').toString('base64');

  it('check-in stores the selfie and location, once a day', async () => {
    prisma.attendanceRecord.findUnique.mockResolvedValue(null);
    const r = await service.checkIn('t1', 'u1', { latitude: 4.6, longitude: 101.1, photo: selfie });
    expect(upload.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ mimetype: 'image/jpeg' }), 'tenants/t1/attendance');
    expect(r).toEqual(expect.objectContaining({ checkInLat: 4.6, checkInPhoto: 'tenants/t1/attendance/x.jpg' }));
    prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'a1', checkInAt: new Date() });
    await expect(service.checkIn('t1', 'u1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('check-in without a photo still works; a bad photo is refused', async () => {
    prisma.attendanceRecord.findUnique.mockResolvedValue(null);
    await service.checkIn('t1', 'u1', { latitude: 1, longitude: 2 });
    expect(upload.uploadFile).not.toHaveBeenCalled();
    await expect(service.checkIn('t1', 'u1', { photo: 'data:text/plain;base64,aGk=' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('check-out needs a check-in and happens once', async () => {
    prisma.attendanceRecord.findUnique.mockResolvedValue(null);
    await expect(service.checkOut('t1', 'u1', {})).rejects.toThrow(/Check in first/);
    prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'a1', checkInAt: new Date() });
    const r = await service.checkOut('t1', 'u1', { latitude: 4, longitude: 101, photo: selfie });
    expect(r).toEqual(expect.objectContaining({ checkOutLat: 4, checkOutPhoto: 'tenants/t1/attendance/x.jpg' }));
    prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'a1', checkInAt: new Date(), checkOutAt: new Date() });
    await expect(service.checkOut('t1', 'u1', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('only managers plan routes for others', async () => {
    await expect(service.createRoute('t1', 'rep1', { userId: 'rep2', name: 'R', routeDate: '2026-11-01' }, ['sales_rep'])).rejects.toBeInstanceOf(ForbiddenException);
    const own = await service.createRoute('t1', 'rep1', { name: 'R', routeDate: '2026-11-01', customerIds: ['c1'] }, ['sales_rep']);
    expect(own.userId).toBe('rep1');
    const other = await service.createRoute('t1', 'm1', { userId: 'rep2', name: 'R', routeDate: '2026-11-01' }, ['manager']);
    expect(other.userId).toBe('rep2');
  });

  it('nearby: the rep\'s customers nearest first', async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: 'far', name: 'Far', latitude: 3.139, longitude: 101.6869 },
      { id: 'near', name: 'Near', latitude: 4.6, longitude: 101.1 },
    ]);
    const r = await service.nearby('t1', 'rep1', ['sales_rep'], 4.5975, 101.0901);
    expect(r.map((c) => c.id)).toEqual(['near', 'far']);
    expect(prisma.customer.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ OR: [{ assignedRepId: 'rep1' }, { assignedRepId: null }] }));
    await expect(service.nearby('t1', 'rep1', [], NaN, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assign customers: managers only, salesman must exist', async () => {
    await expect(service.assignCustomers('t1', ['sales_rep'], { customerIds: ['c1'], repId: 'r1' })).rejects.toBeInstanceOf(ForbiddenException);
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.assignCustomers('t1', ['admin'], { customerIds: ['c1'], repId: 'nope' })).rejects.toThrow(/not found/);
    prisma.user.findFirst.mockResolvedValue({ id: 'r1' });
    const r = await service.assignCustomers('t1', ['admin'], { customerIds: ['c1', 'c2'], repId: 'r1', routeName: ' Ipoh North ' });
    expect(r).toEqual({ updated: 2 });
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({ where: { tenantId: 't1', id: { in: ['c1', 'c2'] } }, data: { assignedRepId: 'r1', routeName: 'Ipoh North' } });
    await service.assignCustomers('t1', ['admin'], { customerIds: ['c1'], repId: null });
    expect(prisma.customer.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { assignedRepId: null } }));
  });

  it('today: attendance plus route stops with visited flags', async () => {
    const t = new Date();
    prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'a1', checkInAt: t });
    prisma.routePlan.findMany.mockResolvedValue([{ id: 'p1', name: 'Ipoh North', status: 'PLANNED', customerIds: ['c1', 'c2', 'gone'] }]);
    prisma.customerVisit.findMany.mockResolvedValue([{ customerId: 'c2', checkInAt: t }]);
    prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }]);
    const r = await service.today('t1', 'rep1');
    expect(r.attendance.status).toBe('IN');
    expect(r.routes[0].stops.map((s: any) => [s.id, !!s.visitedAt])).toEqual([['c1', false], ['c2', true]]);
    expect(r.routes[0].visited).toBe(1);
    expect(r.visitsToday).toBe(1);
  });

  it('team attendance: managers only, with status and selfie links', async () => {
    await expect(service.teamAttendance('t1', ['sales_rep'])).rejects.toBeInstanceOf(ForbiddenException);
    prisma.user.findMany.mockResolvedValue([{ id: 'r1', firstName: 'Ali', lastName: 'B' }, { id: 'r2', firstName: 'Siva', lastName: '' }]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ userId: 'r1', checkInAt: new Date(), checkInPhoto: 'p.jpg' }]);
    const r = await service.teamAttendance('t1', ['admin']);
    expect(r.summary).toEqual({ total: 2, in: 1, out: 0, notIn: 1 });
    expect(r.team.find((x) => x.userId === 'r1')).toEqual(expect.objectContaining({ status: 'IN', checkInPhotoUrl: 'https://files/x.jpg' }));
    expect(r.team.find((x) => x.userId === 'r2')!.status).toBe('NOT_IN');
  });

  it('attendance rules from the settings are enforced on the server', async () => {
    prisma.attendanceRecord.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ settings: { salesApp: { attendance: { selfieRequired: true, gpsRequired: true } } } });
    await expect(service.checkIn('t1', 'u1', { latitude: 1, longitude: 2 })).rejects.toThrow(/selfie is required/);
    await expect(service.checkIn('t1', 'u1', { photo: selfie })).rejects.toThrow(/location is required/);
    await expect(service.checkIn('t1', 'u1', { photo: selfie, latitude: 4.6, longitude: 101.1 })).resolves.toBeDefined();
  });

  it('app config: team only for managers, update prompt, admin flag', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: { salesApp: { features: { expenses: false }, update: { latestVersionCode: 3, minVersionCode: 1, apkUrl: 'https://x/a.apk' } } } });
    const rep = await service.appConfigFor('t1', ['sales_rep'], 2);
    expect(rep.features.team).toBe(false);
    expect(rep.menuOrder).not.toContain('team');
    expect(rep.menuOrder).not.toContain('expenses');
    expect(rep.updateStatus).toBe('AVAILABLE');
    expect(rep.canEditSettings).toBe(false);
    const admin = await service.appConfigFor('t1', ['admin'], 3);
    expect(admin.features.team).toBe(true);
    expect(admin.updateStatus).toBe('NONE');
    expect(admin.canEditSettings).toBe(true);
  });

  it('only an admin changes the settings; a change keeps other tenant settings', async () => {
    await expect(service.updateAppConfig('t1', ['manager'], { currency: 'USD' })).rejects.toBeInstanceOf(ForbiddenException);
    prisma.tenant.findUnique.mockResolvedValue({ settings: { branding: { color: 'red' }, salesApp: { features: { visits: false } } } });
    await expect(service.updateAppConfig('t1', ['admin'], { features: { bogus: true } })).rejects.toBeInstanceOf(BadRequestException);
    const r = await service.updateAppConfig('t1', ['admin'], { notice: { text: 'Stock count Friday', level: 'warning' } });
    expect(r.notice).toEqual({ text: 'Stock count Friday', level: 'warning' });
    expect(r.features.visits).toBe(false);
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { settings: {
      branding: { color: 'red' }, salesApp: { features: { visits: false }, notice: { text: 'Stock count Friday', level: 'warning' } },
    } } });
  });
});
