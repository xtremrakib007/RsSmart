import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: { search?: string; category?: string }) {
    const where: any = { tenantId, isActive: true };
    if (filters?.category) where.category = filters.category;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.customer.findMany({
      where,
      include: { orders: { where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, status: true, total: true, paidAmount: true, balanceDue: true, createdAt: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: { orders: { where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, status: true, total: true, paidAmount: true, balanceDue: true, createdAt: true } }, visits: { where: { tenantId }, orderBy: { checkInAt: 'desc' } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(tenantId: string, data: any) {
    const allowed = [
      'code', 'name', 'email', 'phone', 'address', 'city', 'state',
      'country', 'latitude', 'longitude', 'creditLimit', 'category',
    ];
    const safeData = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => [key, data[key]]),
    );
    if (typeof safeData.name !== 'string' || !safeData.name.trim()) {
      throw new BadRequestException('Customer name is required');
    }
    return this.prisma.customer.create({
      data: { ...safeData, tenantId },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    // Update atomically with tenant scope; a separate find-then-update can race.
    // Exclude tenantId, balance, IDs, and timestamps from client-controlled updates.
    const allowed = [
      'code', 'name', 'email', 'phone', 'address', 'city', 'state',
      'country', 'latitude', 'longitude', 'creditLimit', 'category', 'isActive',
    ];
    const safeData = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => [key, data[key]]),
    );
    const updated = await this.prisma.customer.updateMany({
      where: { id, tenantId },
      data: safeData,
    });
    if (updated.count === 0) throw new NotFoundException('Customer not found');
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    const updated = await this.prisma.customer.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    if (updated.count === 0) throw new NotFoundException('Customer not found');
    return { id, isActive: false };
  }

  async recordVisit(tenantId: string, data: any) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found for this company');

    return this.prisma.customerVisit.create({
      data: {
        customerId: customer.id,
        tenantId,
        userId: data.userId,
        checkInAt: data.checkInAt ? new Date(data.checkInAt) : new Date(),
        ...(data.checkOutAt ? { checkOutAt: new Date(data.checkOutAt) } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
      },
    });
  }

  async getVisits(customerId: string, tenantId: string) {
    return this.prisma.customerVisit.findMany({
      where: { customerId, tenantId },
      orderBy: { checkInAt: 'desc' },
    });
  }
}
