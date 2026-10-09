import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlanLimitExceededException } from '../common/exceptions/plan-limit.exception';

@Injectable()
export class PosSessionsService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
  ) {}

  async getActiveSession(tenantId: string, userId: string, deviceId: string) {
    return this.prisma.posSession.findFirst({
      where: { tenantId, userId, deviceId, status: 'OPEN' },
    });
  }

  async openSession(tenantId: string, outletId: string, userId: string, data: {
    deviceId: string;
    openingCash: number;
    openingDenominations?: Record<string, number>;
  }) {
    const existing = await this.getActiveSession(tenantId, userId, data.deviceId);
    if (existing) {
      throw new BadRequestException('An active session already exists for this device');
    }

    // Phase 23 — enforce POS device limit for never-seen devices
    const existingDevice = await this.prisma.posSession.findFirst({
      where: { tenantId, deviceId: data.deviceId },
    });
    if (!existingDevice) {
      const check = await this.entitlements.checkPosDeviceLimit(tenantId);
      if (!check.allowed) {
        throw new PlanLimitExceededException('POS device', check.current, check.limit);
      }
    }

    return this.prisma.posSession.create({
      data: {
        tenantId,
        outletId,
        userId,
        deviceId: data.deviceId,
        openingCash: data.openingCash,
        openingDenominations: data.openingDenominations || undefined,
        status: 'OPEN',
        openedAt: new Date(),
      },
    });
  }

  async closeSession(tenantId: string, sessionId: string, data: {
    closingCash: number;
    closingDenominations?: Record<string, number>;
    forceClose?: boolean;
  }, outletId?: string) {
    if (!Number.isFinite(data?.closingCash) || data.closingCash < 0 ||
        Math.round(data.closingCash * 100) / 100 !== data.closingCash) {
      throw new BadRequestException('Closing cash must be a non-negative amount with at most two decimal places');
    }
    if (data.forceClose !== undefined && typeof data.forceClose !== 'boolean') {
      throw new BadRequestException('forceClose must be a boolean');
    }
    if (data.closingDenominations !== undefined) {
      const denominations = data.closingDenominations;
      if (!denominations || typeof denominations !== 'object' || Array.isArray(denominations) ||
          Object.entries(denominations).length > 50 ||
          Object.entries(denominations).some(([key, value]) =>
            !key || key.length > 40 || typeof value !== 'number' ||
            !Number.isSafeInteger(value) || value < 0)) {
        throw new BadRequestException('Closing denominations must contain valid non-negative integer counts');
      }
    }
    return this.prisma.$transaction(async (tx: any) => {
      // Lock the OPEN session row before reading movements. Cash movement
      // creation uses the same lock, so closing cannot omit a concurrent entry.
      const locked = await tx.posSession.updateMany({
        where: { id: sessionId, tenantId, status: 'OPEN', ...(outletId ? { outletId } : {}) },
        data: { status: 'OPEN' },
      });
      if (locked.count !== 1) {
        const exists = await tx.posSession.findFirst({ where: { id: sessionId, tenantId, ...(outletId ? { outletId } : {}) }, select: { id: true } });
        if (!exists) throw new NotFoundException('Session not found');
        throw new BadRequestException('Session is already closed');
      }
      const session = await tx.posSession.findFirst({
        where: { id: sessionId, tenantId, status: 'OPEN' },
      });
      if (!session) throw new BadRequestException('Session is already closed');

      const movements = await tx.posCashMovement.findMany({
        where: { tenantId, sessionId: session.id },
      });
      let expectedCash = Number(session.openingCash);
      for (const movement of movements) {
        const amount = Number(movement.amount);
        if (movement.type === 'SALE' || movement.type === 'IN') expectedCash += amount;
        if (movement.type === 'REFUND' || movement.type === 'OUT') expectedCash -= amount;
      }

      const discrepancy = data.closingCash - expectedCash;
      const closed = await tx.posSession.updateMany({
        where: { id: sessionId, tenantId, status: 'OPEN' },
        data: {
          status: data.forceClose ? 'FORCE_CLOSED' : 'CLOSED',
          closedAt: new Date(),
          closingCash: data.closingCash,
          closingDenominations: data.closingDenominations || undefined,
          expectedCash,
          discrepancy,
        },
      });
      if (closed.count !== 1) throw new BadRequestException('Session is already closed');
      return tx.posSession.findFirst({ where: { id: sessionId, tenantId } });
    });
  }

  async getSessionReport(tenantId: string, sessionId: string, outletId?: string) {
    const session = await this.prisma.posSession.findFirst({
      where: { id: sessionId, tenantId, ...(outletId ? { outletId } : {}) },
      include: { user: { omit: { password: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        outletId: session.outletId,
        salesRepId: session.userId,
        createdAt: { gte: session.openedAt },
        source: 'POS',
      },
      include: {
        items: {
          select: {
            id: true, productId: true, quantity: true, unitPrice: true,
            discount: true, taxRate: true, taxAmount: true, total: true,
            product: { select: { id: true, sku: true, name: true, barcode: true, basePrice: true, taxRate: true } },
          },
        },
        payments: { select: { id: true, amount: true, method: true, reference: true, createdAt: true } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    const paymentSummary: Record<string, number> = {};
    let totalSales = 0;
    let totalItems = 0;

    for (const order of orders) {
      totalSales += Number(order.total);
      totalItems += order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      for (const payment of order.payments) {
        paymentSummary[payment.method] = (paymentSummary[payment.method] || 0) + Number(payment.amount);
      }
    }

    return {
      session,
      summary: {
        totalOrders: orders.length,
        totalSales,
        totalItems,
        paymentSummary,
        openingCash: session.openingCash,
        closingCash: session.closingCash,
        expectedCash: session.expectedCash,
        discrepancy: session.discrepancy,
      },
      orders,
    };
  }

  async getSessions(tenantId: string, filters?: { userId?: string; outletId?: string; fromDate?: string; toDate?: string }) {
    const where: any = { tenantId };
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.outletId) where.outletId = filters.outletId;
    if (filters?.fromDate || filters?.toDate) {
      where.openedAt = {};
      if (filters.fromDate) where.openedAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.openedAt.lte = new Date(filters.toDate);
    }

    return this.prisma.posSession.findMany({
      where,
      include: { user: { omit: { password: true } } },
      orderBy: { openedAt: 'desc' },
    });
  }
}
