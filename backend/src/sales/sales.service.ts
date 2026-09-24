import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

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

  createRoute(tenantId: string, userId: string, data: any) {
    return this.prisma.routePlan.create({ data: { tenantId, userId: data.userId ?? userId, routeDate: new Date(data.routeDate), name: data.name, customerIds: data.customerIds ?? [], notes: data.notes } });
  }

  async checkIn(tenantId: string, userId: string, data: any) {
    const workDate = new Date(); workDate.setHours(0,0,0,0);
    return this.prisma.attendanceRecord.upsert({ where: { tenantId_userId_workDate: { tenantId, userId, workDate } }, create: { tenantId, userId, workDate, checkInAt: new Date(), checkInLat: data.latitude, checkInLng: data.longitude, notes: data.notes }, update: { checkInAt: new Date(), checkInLat: data.latitude, checkInLng: data.longitude, notes: data.notes } });
  }

  async checkOut(tenantId: string, userId: string, data: any) {
    const workDate = new Date(); workDate.setHours(0,0,0,0);
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { tenantId_userId_workDate: { tenantId, userId, workDate } } });
    if (!existing) throw new NotFoundException('Attendance record not found. Check in first.');
    return this.prisma.attendanceRecord.update({ where: { id: existing.id }, data: { checkOutAt: new Date(), checkOutLat: data.latitude, checkOutLng: data.longitude } });
  }

  attendance(tenantId: string, userId: string, from?: string, to?: string) {
    const where: any = { tenantId, userId };
    if (from || to) where.workDate = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    return this.prisma.attendanceRecord.findMany({ where, orderBy: { workDate: 'desc' } });
  }
}
