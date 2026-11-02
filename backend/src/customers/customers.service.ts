import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { customerScope, isManager } from '../sales/field-sales.util';

// Fields the client never sets directly.
const PROTECTED = ['id', 'tenantId', 'balance', 'createdAt', 'updatedAt'];
const clean = (data: any) => Object.fromEntries(Object.entries(data || {}).filter(([k]) => !PROTECTED.includes(k)));

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: { search?: string; category?: string; route?: string }, user?: { userId: string; roles?: string[] }) {
    const where: any = { tenantId, isActive: true, AND: [] };
    // A salesman sees his own customers and unassigned ones; managers see all.
    if (user) where.AND.push(customerScope(user.userId, user.roles));
    if (filters?.category) where.category = filters.category;
    if (filters?.route) where.routeName = filters.route;
    if (filters?.search) {
      where.AND.push({ OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ] });
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

  async create(tenantId: string, data: any, user?: { userId: string; roles?: string[] }) {
    const d: any = clean(data);
    // A salesman's new customer is his; only managers assign to someone else.
    if (user && !isManager(user.roles)) d.assignedRepId = user.userId;
    return this.prisma.customer.create({
      data: { ...d, tenantId },
    });
  }

  async update(id: string, tenantId: string, data: any, user?: { userId: string; roles?: string[] }) {
    await this.findOne(id, tenantId);
    const d: any = clean(data);
    if (user && !isManager(user.roles)) delete d.assignedRepId;
    return this.prisma.customer.update({
      where: { id },
      data: d,
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
