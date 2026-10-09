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
      include: { orders: { take: 5, orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: { orders: { orderBy: { createdAt: 'desc' } }, visits: { orderBy: { checkInAt: 'desc' } } },
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
    await this.findOne(id, tenantId);
    // Exclude tenantId, balance, IDs, and timestamps from client-controlled updates.
    const allowed = [
      'code', 'name', 'email', 'phone', 'address', 'city', 'state',
      'country', 'latitude', 'longitude', 'creditLimit', 'category', 'isActive',
    ];
    const safeData = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => [key, data[key]]),
    );
    return this.prisma.customer.update({
      where: { id },
      data: safeData,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
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
