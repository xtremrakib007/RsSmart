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
    return this.prisma.customer.create({
      data: { ...data, tenantId },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findOne(id, tenantId);
    return this.prisma.customer.update({
      where: { id },
      data,
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
    return this.prisma.customerVisit.create({
      data: { ...data, tenantId },
    });
  }

  async getVisits(customerId: string, tenantId: string) {
    return this.prisma.customerVisit.findMany({
      where: { customerId, tenantId },
      orderBy: { checkInAt: 'desc' },
    });
  }
}
