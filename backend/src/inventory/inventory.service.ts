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
      include: { product: { select: { id: true, sku: true, name: true, barcode: true, minStock: true, isActive: true } } },
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
      include: { inventory: { include: { product: { select: { id: true, sku: true, name: true, barcode: true } } } } },
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
    if (!data || typeof data.productId !== 'string' || !data.productId.trim()) {
      throw new BadRequestException('A valid productId is required');
    }
    if (!['INBOUND', 'OUTBOUND', 'ADJUSTMENT'].includes(data.type)) {
      throw new BadRequestException('Invalid inventory movement type');
    }
    if (!Number.isFinite(data.quantity) || data.quantity < 0 ||
      (data.type !== 'ADJUSTMENT' && data.quantity <= 0)) {
      throw new BadRequestException('Quantity must be positive; adjustments may be zero');
    }
    if (data.notes !== undefined && (typeof data.notes !== 'string' || data.notes.length > 2000)) {
      throw new BadRequestException('Notes must be a string of at most 2000 characters');
    }
    if (data.referenceId !== undefined && (typeof data.referenceId !== 'string' || data.referenceId.length > 200)) {
      throw new BadRequestException('Reference ID must be a string of at most 200 characters');
    }

    // Keep the version check, quantity update and movement insert in ONE
    // transaction. Otherwise a conflict could still leave an orphan movement.
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findFirst({
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
      } else {
        newQuantity = data.quantity;
      }

      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, tenantId, outletId, version: inventory.version },
        data: { quantity: newQuantity, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Inventory was modified by another operation. Please retry.');
      }

      const movement = await tx.stockMovement.create({
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
      });

      return { inventory: { ...inventory, quantity: newQuantity, version: inventory.version + 1 }, movement };
    });
  }

  async reserveStock(tenantId: string, outletId: string, productId: string, quantity: number) {
    if (typeof productId !== 'string' || !productId.trim()) throw new BadRequestException('A valid productId is required');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Reservation quantity must be positive and finite');
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
      where: { id: inventory.id, tenantId, outletId, version: inventory.version },
      data: { reserved: { increment: quantity }, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Inventory was modified by another operation. Please retry.');
    }

    return { ...inventory, reserved: Number(inventory.reserved) + quantity, version: inventory.version + 1 };
  }

  async releaseStock(tenantId: string, outletId: string, productId: string, quantity: number) {
    if (typeof productId !== 'string' || !productId.trim()) throw new BadRequestException('A valid productId is required');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Release quantity must be positive and finite');
    const inventory = await this.prisma.inventory.findFirst({
      where: { tenantId, outletId, productId },
    });
    if (!inventory) throw new NotFoundException('Inventory not found at this outlet');

    if (Number(inventory.reserved) < quantity) throw new BadRequestException('Cannot release more stock than is reserved');
    const newReserved = Number(inventory.reserved) - quantity;

    // Phase 26: optimistic locking
    const updated = await this.prisma.inventory.updateMany({
      where: { id: inventory.id, tenantId, outletId, version: inventory.version },
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
    if (!data || typeof data.productId !== 'string' || !data.productId.trim()) {
      throw new BadRequestException('A valid productId is required');
    }
    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be a positive finite number');
    }
    if (data.fromWarehouseId && data.toWarehouseId && data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }
    if (data.notes !== undefined && (typeof data.notes !== 'string' || data.notes.length > 2000)) {
      throw new BadRequestException('Notes must be a string of at most 2000 characters');
    }

    // Source, destination and both ledger entries must commit or roll back
    // together. A sequential update outside the transaction can lose stock
    // or leave only one side of a transfer recorded.
    return this.prisma.$transaction(async (tx) => {
      const fromInv = await tx.inventory.findFirst({
        where: { tenantId, outletId, productId: data.productId, warehouseId: data.fromWarehouseId || null },
      });
      if (!fromInv || Number(fromInv.quantity) < data.quantity) {
        throw new BadRequestException('Insufficient stock at source');
      }

      const sourceUpdated = await tx.inventory.updateMany({
        where: { id: fromInv.id, tenantId, outletId, version: fromInv.version },
        data: { quantity: { decrement: data.quantity }, version: { increment: 1 } },
      });
      if (sourceUpdated.count !== 1) {
        throw new ConflictException('Source inventory was modified by another operation. Please retry.');
      }

      const toInv = await tx.inventory.findFirst({
        where: { tenantId, outletId, productId: data.productId, warehouseId: data.toWarehouseId || null },
      });

      let destination;
      if (toInv) {
        const destinationUpdated = await tx.inventory.updateMany({
          where: { id: toInv.id, tenantId, outletId, version: toInv.version },
          data: { quantity: { increment: data.quantity }, version: { increment: 1 } },
        });
        if (destinationUpdated.count !== 1) {
          throw new ConflictException('Destination inventory was modified by another operation. Please retry.');
        }
        destination = { ...toInv, quantity: Number(toInv.quantity) + data.quantity, version: toInv.version + 1 };
      } else {
        destination = await tx.inventory.create({
          data: {
            tenantId,
            outletId,
            productId: data.productId,
            warehouseId: data.toWarehouseId,
            quantity: data.quantity,
            reserved: 0,
          },
        });
      }

      const sourceMovement = await tx.stockMovement.create({
        data: {
          tenantId,
          outletId,
          inventoryId: fromInv.id,
          type: 'TRANSFER',
          quantity: data.quantity,
          notes: `Transfer out: ${data.notes || ''}`,
          createdBy: userId,
        },
      });
      const destinationMovement = await tx.stockMovement.create({
        data: {
          tenantId,
          outletId,
          inventoryId: destination.id,
          type: 'TRANSFER',
          quantity: data.quantity,
          notes: `Transfer in: ${data.notes || ''}`,
          createdBy: userId,
        },
      });

      return {
        source: { ...fromInv, quantity: Number(fromInv.quantity) - data.quantity, version: fromInv.version + 1 },
        destination,
        movements: [sourceMovement, destinationMovement],
      };
    });
  }
}\n}\n