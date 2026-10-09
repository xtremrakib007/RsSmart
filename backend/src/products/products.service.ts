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
    // Foreign keys must belong to this tenant; UUIDs are not authorization.
    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: data.categoryId, tenantId } });
      if (!category) throw new BadRequestException('Category not found for this company');
    }
    if (data.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: data.unitId, tenantId } });
      if (!unit) throw new BadRequestException('Unit not found for this company');
    }

    if (typeof data.sku !== 'string' || !data.sku.trim() ||
        typeof data.name !== 'string' || !data.name.trim() ||
        !Number.isFinite(Number(data.basePrice)) || Number(data.basePrice) < 0) {
      throw new BadRequestException('Product SKU, name, and a non-negative base price are required');
    }
    const existing = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: data.sku } },
    });
    if (existing) throw new BadRequestException('SKU already exists');

    const allowed = [
      'sku', 'name', 'description', 'barcode', 'categoryId', 'unitId',
      'basePrice', 'costPrice', 'taxRate', 'isActive', 'trackInventory',
      'minStock', 'maxStock', 'attributes', 'images',
    ];
    const safeData = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => [key, data[key]]),
    );
    return this.prisma.product.create({
      data: { ...safeData, tenantId },
      include: { category: true, unit: true },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    await this.findOne(id, tenantId);
    // Never spread request bodies into Prisma updates: this prevents clients
    // from changing tenantId or writing server-managed fields.
    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: data.categoryId, tenantId } });
      if (!category) throw new BadRequestException('Category not found for this company');
    }
    if (data.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { id: data.unitId, tenantId } });
      if (!unit) throw new BadRequestException('Unit not found for this company');
    }
    const allowed = [
      'sku', 'name', 'description', 'barcode', 'categoryId', 'unitId',
      'basePrice', 'costPrice', 'taxRate', 'isActive', 'trackInventory',
      'minStock', 'maxStock', 'attributes', 'images',
    ];
    const safeData = Object.fromEntries(
      allowed.filter((key) => Object.prototype.hasOwnProperty.call(data, key)).map((key) => [key, data[key]]),
    );
    return this.prisma.product.update({
      where: { id, tenantId },
      data: safeData,
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
