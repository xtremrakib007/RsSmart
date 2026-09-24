import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: { categoryId?: string; search?: string; isActive?: boolean }) {
    const where: any = { tenantId };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.product.findMany({
      where,
      include: { category: true, unit: true, inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true, unit: true, inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByBarcode(barcode: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { barcode, tenantId, isActive: true },
      include: { category: true, unit: true, inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(tenantId: string, data: any) {
    const existing = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: data.sku } },
    });
    if (existing) throw new BadRequestException('SKU already exists');

    return this.prisma.product.create({
      data: { ...data, tenantId },
      include: { category: true, unit: true },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({
      where: { id },
      data,
      include: { category: true, unit: true },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      include: { children: true },
    });
  }

  async getUnits(tenantId: string) {
    return this.prisma.unit.findMany({ where: { tenantId } });
  }
}
