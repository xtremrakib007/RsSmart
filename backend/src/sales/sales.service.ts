import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import {
  attendanceStatus, customerScope, decodeSelfie, isAdmin, isManager, minutesWorked, sortByDistance, workDateOf,
} from './field-sales.util';
import {
  DEFAULT_SALES_APP_CONFIG, SalesAppConfig, applySalesAppConfigPatch, mergeSalesAppConfig, sanitizeSalesAppConfigPatch, updateStatus,
} from './app-config.util';

const CUSTOMER_FIELDS = {
  id: true, code: true, name: true, phone: true, address: true, city: true, latitude: true, longitude: true,
  balance: true, creditLimit: true, category: true, routeName: true, assignedRepId: true,
} as const;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService, private readonly upload: UploadService) {}

  async dashboard(tenantId: string, userId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [orders, visits, payments, target] = await Promise.all([
      this.prisma.order.findMany({ where: { tenantId, salesRepId: userId, createdAt: { gte: start, lte: end } }, select: { total: true } }),
      this.prisma.customerVisit.count({ where: { tenantId, userId, checkInAt: { gte: start, lte: end } } }),
      this.prisma.payment.findMany({ where: { order: { tenantId, salesRepId: userId }, createdAt: { gte: start, lte: end } }, select: { amount: true } }),
      this.prisma.salesTarget.findFirst({ where: { tenantId, userId, periodStart: { lte: start }, periodEnd: { gte: start } }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      todayOrders: orders.length,
      todayRevenue: orders.reduce((s, o) => s + Number(o.total), 0),
      todayVisits: visits,
      todayCollections: payments.reduce((s, p) => s + Number(p.amount), 0),
      target: target ? { amount: Number(target.targetAmount), achieved: Number(target.achievedAmount), orders: target.achievedOrders } : null,
    };
  }

  listTargets(tenantId: string, userId: string) {
    return this.prisma.salesTarget.findMany({ where: { tenantId, userId }, orderBy: { periodStart: 'desc' } });
  }

  createTarget(tenantId: string, data: any) {
    return this.prisma.salesTarget.create({ data: {
      tenantId, userId: data.userId,
      periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
      targetAmount: data.targetAmount, targetOrders: data.targetOrders ?? 0, notes: data.notes,
    }});
  }

  listRoutes(tenantId: string, userId: string, date?: string) {
    const where: any = { tenantId, userId };
    if (date) { const d = new Date(date); d.setHours(0,0,0,0); const e = new Date(d); e.setDate(e.getDate()+1); where.routeDate = { gte: d, lt: e }; }
    return this.prisma.routePlan.findMany({ where, orderBy: { routeDate: 'asc' } });
  }

  async createRoute(tenantId: string, userId: string, data: any, roles: string[] = []) {
    // Only managers plan routes for someone else.
    const owner = data.userId && data.userId !== userId ? data.userId : userId;
    if (owner !== userId && !isManager(roles)) throw new ForbiddenException('Only a manager can plan a route for another user.');
    if (!data.name || !data.routeDate) throw new BadRequestException('name and routeDate are required');
    return this.prisma.routePlan.create({ data: { tenantId, userId: owner, routeDate: new Date(data.routeDate), name: data.name, customerIds: Array.isArray(data.customerIds) ? data.customerIds : [], notes: data.notes } });
  }

  /** Stores a selfie sent as a data URL; returns the storage object name. */
  private async saveSelfie(tenantId: string, userId: string, dataUrl: unknown, kind: 'in' | 'out'): Promise<string | undefined> {
    let file;
    try { file = decodeSelfie(dataUrl, `${userId}-${kind}`); } catch (e: any) { throw new BadRequestException(e.message); }
    if (!file) return undefined;
    return this.upload.uploadFile(file as any, `tenants/${tenantId}/attendance`);
  }

  // ── App settings (changed on the server, no app rebuild) ──

  /** This tenant's sales app settings, defaults filled in. */
  async appConfig(tenantId: string): Promise<SalesAppConfig> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (t?.settings as Record<string, any>) || {};
    return mergeSalesAppConfig(settings.salesApp);
  }

  /** What the app loads at start: settings for this user, plus whether to update. */
  async appConfigFor(tenantId: string, roles: string[], versionCode?: number) {
    const cfg = await this.appConfig(tenantId);
    // The team screen is for managers whatever the setting says.
    const features = { ...cfg.features, team: cfg.features.team && isManager(roles) };
    return {
      ...cfg,
      features,
      menuOrder: cfg.menuOrder.filter((f) => features[f]),
      updateStatus: updateStatus(cfg, versionCode),
      canEditSettings: isAdmin(roles),
    };
  }

  /** Admin changes some settings; the rest stay as they are. */
  async updateAppConfig(tenantId: string, roles: string[], patch: unknown) {
    if (!isAdmin(roles)) throw new ForbiddenException('Only an admin can change the sales app settings.');
    let clean;
    try { clean = sanitizeSalesAppConfigPatch(patch); } catch (e: any) { throw new BadRequestException(e.message); }
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    const settings = (t.settings as Record<string, any>) || {};
    const salesApp = applySalesAppConfigPatch(settings.salesApp, clean);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: { ...settings, salesApp } } });
    return mergeSalesAppConfig(salesApp);
  }

  /** Back to the defaults for everything. */
  async resetAppConfig(tenantId: string, roles: string[]) {
    if (!isAdmin(roles)) throw new ForbiddenException('Only an admin can change the sales app settings.');
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    const { salesApp: _old, ...rest } = (t.settings as Record<string, any>) || {};
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: rest } });
    return DEFAULT_SALES_APP_CONFIG;
  }

  /** Attendance rules from the settings, checked on the server so older apps follow them too. */
  private async checkAttendanceRules(tenantId: string, data: any) {
    const { attendance } = await this.appConfig(tenantId);
    if (attendance.selfieRequired && !data?.photo) throw new BadRequestException('A selfie is required to check in or out.');
    const coord = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    if (attendance.gpsRequired && !(coord(data?.latitude) && coord(data?.longitude))) {
      throw new BadRequestException('Your location is required to check in or out. Turn on GPS and try again.');
    }
  }

  async checkIn(tenantId: string, userId: string, data: any) {
    await this.checkAttendanceRules(tenantId, data);
    const workDate = workDateOf();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { tenantId_userId_workDate: { tenantId, userId, workDate } } });
    // One check-in per day: a second one would overwrite the real start time.
    if (existing?.checkInAt) throw new ConflictException('Already checked in today.');
    const photo = await this.saveSelfie(tenantId, userId, data.photo, 'in');
    const fields = { checkInAt: new Date(), checkInLat: data.latitude, checkInLng: data.longitude, checkInPhoto: photo, notes: data.notes };
    return this.prisma.attendanceRecord.upsert({
      where: { tenantId_userId_workDate: { tenantId, userId, workDate } },
      create: { tenantId, userId, workDate, ...fields },
      update: fields,
    });
  }

  async checkOut(tenantId: string, userId: string, data: any) {
    const workDate = workDateOf();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { tenantId_userId_workDate: { tenantId, userId, workDate } } });
    if (!existing || !existing.checkInAt) throw new NotFoundException('Attendance record not found. Check in first.');
    if (existing.checkOutAt) throw new ConflictException('Already checked out today.');
    await this.checkAttendanceRules(tenantId, data);
    const photo = await this.saveSelfie(tenantId, userId, data.photo, 'out');
    return this.prisma.attendanceRecord.update({ where: { id: existing.id }, data: { checkOutAt: new Date(), checkOutLat: data.latitude, checkOutLng: data.longitude, checkOutPhoto: photo } });
  }

  // ── Customers for the field ────────────────────────────────

  /** The customers this user works with (managers: all), optionally one route. */
  myCustomers(tenantId: string, userId: string, roles: string[], route?: string) {
    return this.prisma.customer.findMany({
      where: { tenantId, isActive: true, ...customerScope(userId, roles), ...(route ? { routeName: route } : {}) },
      select: CUSTOMER_FIELDS,
      orderBy: { name: 'asc' },
    });
  }

  /** The user's customers nearest first from where they stand. */
  async nearby(tenantId: string, userId: string, roles: string[], lat: number, lng: number, limit?: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('lat and lng are required');
    const customers = await this.myCustomers(tenantId, userId, roles);
    // How many to list comes from the app settings unless the app asks for a number.
    const max = limit && Number.isFinite(limit) ? limit : (await this.appConfig(tenantId)).nearbyLimit;
    return sortByDistance(customers, lat, lng, max);
  }

  /** Route names in use, with how many customers each has. */
  async routeNames(tenantId: string, userId: string, roles: string[]) {
    const rows = await this.prisma.customer.groupBy({
      by: ['routeName'], where: { tenantId, isActive: true, ...customerScope(userId, roles) }, _count: { _all: true },
    });
    return rows.map((r: any) => ({ routeName: r.routeName || null, customers: r._count._all }))
      .sort((a, b) => String(a.routeName || '~').localeCompare(String(b.routeName || '~')));
  }

  /** Managers: give customers to a salesman and/or a route. */
  async assignCustomers(tenantId: string, roles: string[], data: any) {
    if (!isManager(roles)) throw new ForbiddenException('Only a manager can assign customers.');
    const ids: string[] = Array.isArray(data.customerIds) ? data.customerIds.filter((x: unknown) => typeof x === 'string') : [];
    if (!ids.length) throw new BadRequestException('customerIds is required');
    const set: any = {};
    if ('repId' in data) {
      if (data.repId) {
        const rep = await this.prisma.user.findFirst({ where: { id: data.repId, tenantId } });
        if (!rep) throw new NotFoundException('Salesman not found');
      }
      set.assignedRepId = data.repId || null;
    }
    if ('routeName' in data) set.routeName = (data.routeName || '').trim() || null;
    if (!Object.keys(set).length) throw new BadRequestException('Give repId and/or routeName');
    const r = await this.prisma.customer.updateMany({ where: { tenantId, id: { in: ids } }, data: set });
    return { updated: r.count };
  }

  /**
   * Today for the user: attendance, today's route plans with their
   * customers and whether each was visited today.
   */
  async today(tenantId: string, userId: string) {
    const start = workDateOf();
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [att, plans, visits] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { tenantId_userId_workDate: { tenantId, userId, workDate: start } } }),
      this.prisma.routePlan.findMany({ where: { tenantId, userId, routeDate: { gte: start, lt: end } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.customerVisit.findMany({ where: { tenantId, userId, checkInAt: { gte: start, lt: end } }, select: { customerId: true, checkInAt: true } }),
    ]);
    const ids = [...new Set(plans.flatMap((p: any) => (Array.isArray(p.customerIds) ? p.customerIds : [])))] as string[];
    const customers = ids.length
      ? await this.prisma.customer.findMany({ where: { tenantId, id: { in: ids } }, select: CUSTOMER_FIELDS })
      : [];
    const byId = new Map(customers.map((c: any) => [c.id, c]));
    const visitedAt = new Map<string, Date>();
    visits.forEach((v: any) => { if (!visitedAt.has(v.customerId)) visitedAt.set(v.customerId, v.checkInAt); });
    const routes = plans.map((p: any) => {
      const stops = (Array.isArray(p.customerIds) ? p.customerIds : [])
        .map((id: string) => byId.get(id))
        .filter(Boolean)
        .map((c: any) => ({ ...c, visitedAt: visitedAt.get(c.id) || null }));
      return { id: p.id, name: p.name, status: p.status, notes: p.notes, stops, visited: stops.filter((x: any) => x.visitedAt).length };
    });
    return {
      attendance: att ? { ...att, status: attendanceStatus(att), minutesWorked: minutesWorked(att) } : { status: 'NOT_IN', minutesWorked: 0 },
      routes,
      visitsToday: visitedAt.size,
    };
  }

  // ── Team (managers) ─────────────────────────────────────────

  /** Managers: every field user's attendance for a day, with selfie links. */
  async teamAttendance(tenantId: string, roles: string[], date?: string) {
    if (!isManager(roles)) throw new ForbiddenException('Only a manager can see the team.');
    const day = workDateOf(date || new Date());
    const [users, recs] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, status: 'ACTIVE', roles: { some: { role: { name: 'sales_rep' } } } },
        select: { id: true, firstName: true, lastName: true, phone: true },
        orderBy: { firstName: 'asc' },
      }),
      this.prisma.attendanceRecord.findMany({ where: { tenantId, workDate: day } }),
    ]);
    const byUser = new Map(recs.map((r: any) => [r.userId, r]));
    const url = (f?: string | null) => (f ? this.upload.getFileUrl(f).catch(() => null) : Promise.resolve(null));
    const rows = await Promise.all(users.map(async (u: any) => {
      const r: any = byUser.get(u.id) || null;
      return {
        userId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), phone: u.phone,
        status: attendanceStatus(r), minutesWorked: minutesWorked(r),
        checkInAt: r?.checkInAt || null, checkOutAt: r?.checkOutAt || null,
        checkInLat: r?.checkInLat ?? null, checkInLng: r?.checkInLng ?? null,
        checkInPhotoUrl: await url(r?.checkInPhoto), checkOutPhotoUrl: await url(r?.checkOutPhoto),
      };
    }));
    return {
      date: day,
      summary: { total: rows.length, in: rows.filter((r) => r.status === 'IN').length, out: rows.filter((r) => r.status === 'OUT').length, notIn: rows.filter((r) => r.status === 'NOT_IN').length },
      team: rows,
    };
  }

  attendance(tenantId: string, userId: string, from?: string, to?: string) {
    const where: any = { tenantId, userId };
    if (from || to) where.workDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    return this.prisma.attendanceRecord.findMany({ where, orderBy: { workDate: 'desc' } });
  }
}
