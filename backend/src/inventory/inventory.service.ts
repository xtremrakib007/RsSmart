import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

// Every method now takes an outletId: stock is tracked independently per
// outlet (Phase 11). All Inventory/StockMovement lookups are scoped to
// (tenantId, outletId) so the same product's stock at two different outlets
// can never be confused with each other.
//
// Phase 26: All mutation methods use optimistic locking via the `version`
// field. The pattern is: read the row (getting its current version), then
// update with `updateMany({ where: { id, version }, data: { ..., version: { increment: 1 } } })`.
// If the count is zero, another transaction modified the row between our
// read and write — throw ConflictException so the caller can retry.
@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getStockLevels(tenantId: string, outletId: string, filters?: { productId?: string; lowStock?: boolean }) {
    const where: any = { tenantId, outletId };
    if (filters?.productId) where.productId = filters.productId;

    const inventory = await this.prisma.inventory.findMany({
      where,
      include: { product: true },
    });

    if (filters?.lowStock) {
      return inventory.filter((inv) => {
        const minStock = inv.product.minStock ? Number(inv.product.minStock) : 0;
        return Number(inv.quantity) <= minStock;
      });
    }

    return inventory;
  }

  async getStockMovement(tenantId: string, outletId: string, productId: string) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId, outletId, inventory: { productId } },
      include: { inventory: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async adjustStock(tenantId: string, outletId: string, userId: string, data: {
    productId: string;
    quantity: number;
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT';
    notes?: string;
    referenceId?: string;
  }) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId: data.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory record not found for this product at this outlet');
    }

    let newQuantity = Number(inventory.quantity);
    if (data.type === 'INBOUND') newQuantity += data.quantity;
    else if (data.type === 'OUTBOUND') {
      if (newQuantity < data.quantity) {
        throw new BadRequestException('Insufficient stock for outbound movement');
      }
      newQuantity -= data.quantity;
    } else if (data.type === 'ADJUSTMENT') {
      newQuantity = data.quantity;
    }

    // Phase 26: optimistic locking — only succeed if version hasn't changed since read.
    const [updatedInventory, movement] = await this.prisma.$transaction([
      this.prisma.inventory.updateMany({
        where: { id: inventory.id, version: inventory.version },
        data: { quantity: newQuantity, version: { increment: 1 } },
      }),
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          outletId,
          inventoryId: inventory.id,
          type: data.type,
          quantity: data.quantity,
          referenceId: data.referenceId,
          notes: data.notes,
          createdBy: userId,
        },
      }),
    ]);

    if (updatedInventory.count === 0) {
      throw new ConflictException('Inventory was modified by another operation. Please retry.');
    }

    return { inventory: { ...inventory, quantity: newQuantity, version: inventory.version + 1 }, movement };
  }

  async reserveStock(tenantId: string, outletId: string, productId: string, quantity: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId },
    });
    if (!inventory) throw new NotFoundException('Inventory not found at this outlet');

    const available = Number(inventory.quantity) - Number(inventory.reserved);
    if (available < quantity) {
      throw new BadRequestException(`Only ${available} units available. Requested: ${quantity}`);
    }

    // Phase 26: optimistic locking
    const updated = await this.prisma.inventory.updateMany({
      where: { id: inventory.id, version: inventory.version },
      data: { reserved: { increment: quantity }, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Inventory was modified by another operation. Please retry.');
    }

    return { ...inventory, reserved: Number(inventory.reserved) + quantity, version: inventory.version + 1 };
  }

  async releaseStock(tenantId: string, outletId: string, productId: string, quantity: number) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId },
    });
    if (!inventory) throw new NotFoundException('Inventory not found at this outlet');

    const newReserved = Math.max(0, Number(inventory.reserved) - quantity);

    // Phase 26: optimistic locking
    const updated = await this.prisma.inventory.updateMany({
      where: { id: inventory.id, version: inventory.version },
      data: { reserved: newReserved, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Inventory was modified by another operation. Please retry.');
    }

    return { ...inventory, reserved: newReserved, version: inventory.version + 1 };
  }

  /**
   * Transfers stock between two warehouses/sub-locations WITHIN the same
   * outlet. Cross-outlet transfers are out of scope for this pass.
   */
  async transferStock(tenantId: string, outletId: string, userId: string, data: {
    productId: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    quantity: number;
    notes?: string;
  }) {
    const fromInv = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId: data.productId, warehouseId: data.fromWarehouseId || null },
    });
    if (!fromInv || Number(fromInv.quantity) < data.quantity) {
      throw new BadRequestException('Insufficient stock at source');
    }

    let toInv = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId: data.productId, warehouseId: data.toWarehouseId || null },
    });

    // Phase 26: optimistic locking on both source and destination.
    // Source update must succeed with its current version.
    const sourceUpdated = await this.prisma.inventory.updateMany({
      where: { id: fromInv.id, version: fromInv.version },
      data: { quantity: { decrement: data.quantity }, version: { increment: 1 } },
    });
    if (sourceUpdated.count === 0) {
      throw new ConflictException('Source inventory was modified by another operation. Please retry.');
    }

    const operations: any[] = [
      this.prisma.stockMovement.create({
        data: {
          tenantId,
          outletId,
          inventoryId: fromInv.id,
          type: 'TRANSFER',
          quantity: data.quantity,
          notes: `Transfer out: ${data.notes || ''}`,
          createdBy: userId,
        },
      }),
    ];

    if (toInv) {
      // Destination update must also succeed with its current version.
      const destUpdated = await this.prisma.inventory.updateMany({
        where: { id: toInv.id, version: toInv.version },
        data: { quantity: { increment: data.quantity }, version: { increment: 1 } },
      });
      if (destUpdated.count === 0) {
        throw new ConflictException('Destination inventory was modified by another operation. Please retry.');
      }

      operations.push(
        this.prisma.stockMovement.create({
          data: {
            tenantId,
            outletId,
            inventoryId: toInv.id,
            type: 'TRANSFER',
            quantity: data.quantity,
            notes: `Transfer in: ${data.notes || ''}`,
            createdBy: userId,
          },
        }),
      );
    } else {
      operations.push(
        this.prisma.inventory.create({
          data: {
            tenantId,
            outletId,
            productId: data.productId,
            warehouseId: data.toWarehouseId,
            quantity: data.quantity,
          },
        }),
      );
    }

    const results = await this.prisma.$transaction(operations);
    return results;
  }
}
