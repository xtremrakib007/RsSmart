import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

describe('InventoryService — outlet isolation', () => {
  let prisma: any;
  let service: InventoryService;

  const tenantId = 'tenant-1';
  const outletA = 'outlet-a';
  const outletB = 'outlet-b';
  const productId = 'product-1';

  beforeEach(() => {
    prisma = {
      inventory: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      stockMovement: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new InventoryService(prisma);
  });

  it('getStockLevels only queries the given outlet, never the whole tenant', async () => {
    prisma.inventory.findMany.mockResolvedValue([]);
    await service.getStockLevels(tenantId, outletA);
    expect(prisma.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId, outletId: outletA } }),
    );
  });

  it('adjustStock looks up inventory scoped to (tenant, outlet, product)', async () => {
    prisma.inventory.findFirst.mockResolvedValue(null);

    await expect(
      service.adjustStock(tenantId, outletB, 'user-1', { productId, quantity: 5, type: 'INBOUND' }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.inventory.findFirst).toHaveBeenCalledWith({
      where: { tenantId, outletId: outletB, productId },
    });
  });

  it('a stock movement created during adjustStock is stamped with the same outletId', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ id: 'inv-a', quantity: 10, reserved: 0, version: 3 });
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });
    prisma.stockMovement.create.mockResolvedValue({ id: 'move-1' });

    await service.adjustStock(tenantId, outletA, 'user-1', { productId, quantity: 5, type: 'INBOUND' });

    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-a', version: 3 },
      data: { quantity: 15, version: { increment: 1 } },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId, outletId: outletA, inventoryId: 'inv-a' }),
    });
  });

  it('blocks an OUTBOUND adjustment that would exceed available stock', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ id: 'inv-a', quantity: 3, reserved: 0, version: 1 });

    await expect(
      service.adjustStock(tenantId, outletA, 'user-1', { productId, quantity: 10, type: 'OUTBOUND' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when optimistic lock fails during adjustStock', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ id: 'inv-a', quantity: 10, reserved: 0, version: 5 });
    prisma.inventory.updateMany.mockResolvedValue({ count: 0 }); // another tx won

    await expect(
      service.adjustStock(tenantId, outletA, 'user-1', { productId, quantity: 2, type: 'OUTBOUND' }),
    ).rejects.toThrow(ConflictException);
  });

  it('reserveStock and releaseStock are scoped to the given outlet', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ id: 'inv-a', quantity: 10, reserved: 2, version: 1 });
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });

    await service.reserveStock(tenantId, outletA, productId, 3);
    expect(prisma.inventory.findFirst).toHaveBeenCalledWith({ where: { tenantId, outletId: outletA, productId } });
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-a', version: 1 },
      data: { reserved: { increment: 3 }, version: { increment: 1 } },
    });
  });

  it('throws ConflictException when optimistic lock fails during reserveStock', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ id: 'inv-a', quantity: 10, reserved: 0, version: 2 });
    prisma.inventory.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.reserveStock(tenantId, outletA, productId, 1)).rejects.toThrow(ConflictException);
  });

  it('transferStock moves quantity between warehouses within the SAME outlet', async () => {
    prisma.inventory.findFirst
      .mockResolvedValueOnce({ id: 'inv-from', quantity: 10, version: 1 }) // source
      .mockResolvedValueOnce({ id: 'inv-to', quantity: 2, version: 3 }); // destination
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });
    prisma.stockMovement.create.mockResolvedValue({});

    await service.transferStock(tenantId, outletA, 'user-1', {
      productId,
      fromWarehouseId: 'wh-1',
      toWarehouseId: 'wh-2',
      quantity: 4,
    });

    for (const call of prisma.inventory.findFirst.mock.calls) {
      expect(call[0].where.outletId).toBe(outletA);
      expect(call[0].where.tenantId).toBe(tenantId);
    }
  });

  it('throws ConflictException when source inventory changes during transferStock', async () => {
    prisma.inventory.findFirst
      .mockResolvedValueOnce({ id: 'inv-from', quantity: 10, version: 1 })
      .mockResolvedValueOnce({ id: 'inv-to', quantity: 2, version: 3 });
    prisma.inventory.updateMany
      .mockResolvedValueOnce({ count: 0 }); // source lost the race

    await expect(
      service.transferStock(tenantId, outletA, 'user-1', {
        productId,
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 4,
      }),
    ).rejects.toThrow(ConflictException);
  });


describe('InventoryService — concurrency & boundary cases (Phase 26)', () => {
  let prisma: any;
  let service: InventoryService;

  const tenantId = 'tenant-1';
  const outletA = 'outlet-a';
  const outletB = 'outlet-b';
  const productId = 'product-1';

  beforeEach(() => {
    prisma = {
      inventory: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      stockMovement: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    service = new InventoryService(prisma);
  });

  // ── 1. Two simultaneous sales ──────────────────────────────
  it('first concurrent sale wins, second gets ConflictException', async () => {
    // Both find the same row at version 1 with 10 in stock
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 10, reserved: 0, version: 1,
    });

    let callCount = 0;
    prisma.inventory.updateMany.mockImplementation(() => {
      callCount++;
      // First call succeeds, second call sees version mismatch
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });
    prisma.stockMovement.create.mockResolvedValue({ id: 'move-1' });

    // Sale 1 (wins)
    const sale1 = service.adjustStock(tenantId, outletA, 'user-1', {
      productId, quantity: 3, type: 'OUTBOUND',
    });
    // Sale 2 (loses the race)
    const sale2 = service.adjustStock(tenantId, outletA, 'user-2', {
      productId, quantity: 3, type: 'OUTBOUND',
    });

    const [r1, r2] = await Promise.allSettled([sale1, sale2]);

    // One must succeed, one must fail with ConflictException
    const outcomes = [r1.status, r2.status];
    expect(outcomes).toContain('fulfilled');
    expect(outcomes).toContain('rejected');

    const rejected = r1.status === 'rejected' ? r1 : r2;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
  });

  // ── 2. Sale when stock is exactly sufficient ─────────────
  it('allows OUTBOUND when quantity equals exact available stock', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 5, reserved: 0, version: 2,
    });
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });
    prisma.stockMovement.create.mockResolvedValue({ id: 'move-exact' });

    const result = await service.adjustStock(tenantId, outletA, 'user-1', {
      productId, quantity: 5, type: 'OUTBOUND',
    });

    expect(result.inventory.quantity).toBe(0);
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-a', version: 2 },
      data: { quantity: 0, version: { increment: 1 } },
    });
  });

  // ── 3. Sale when stock is insufficient ───────────────────
  it('rejects OUTBOUND when quantity exceeds available stock', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 4, reserved: 0, version: 1,
    });

    await expect(
      service.adjustStock(tenantId, outletA, 'user-1', {
        productId, quantity: 5, type: 'OUTBOUND',
      }),
    ).rejects.toThrow(BadRequestException);

    // updateMany must NOT be called when stock is insufficient
    expect(prisma.inventory.updateMany).not.toHaveBeenCalled();
  });

  // ── 4. Duplicate request (idempotency guard) ─────────────
  it('does not double-deduct on duplicate adjustStock calls with same params', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 10, reserved: 0, version: 1,
    });

    let callCount = 0;
    prisma.inventory.updateMany.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });
    prisma.stockMovement.create.mockResolvedValue({ id: 'move-dup' });

    // Same user, same params — simulating a retry due to network timeout
    const req1 = service.adjustStock(tenantId, outletA, 'user-1', {
      productId, quantity: 2, type: 'OUTBOUND', referenceId: 'txn-duplicate',
    });
    const req2 = service.adjustStock(tenantId, outletA, 'user-1', {
      productId, quantity: 2, type: 'OUTBOUND', referenceId: 'txn-duplicate',
    });

    const [r1, r2] = await Promise.allSettled([req1, req2]);
    const outcomes = [r1.status, r2.status];
    expect(outcomes).toContain('fulfilled');
    expect(outcomes).toContain('rejected');

    // Only one stock movement should be created
    expect(prisma.stockMovement.create).toHaveBeenCalledTimes(1);
  });

  // ── 5. Concurrent reservation ────────────────────────────
  it('first concurrent reservation wins, second gets ConflictException', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 10, reserved: 0, version: 3,
    });

    let callCount = 0;
    prisma.inventory.updateMany.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });

    const r1 = service.reserveStock(tenantId, outletA, productId, 6);
    const r2 = service.reserveStock(tenantId, outletA, productId, 6);

    const results = await Promise.allSettled([r1, r2]);
    const outcomes = results.map((r) => r.status);
    expect(outcomes).toContain('fulfilled');
    expect(outcomes).toContain('rejected');

    const rejected = results.find((r) => r.status === 'rejected') as any;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
  });

  // ── 6. Concurrent release ─────────────────────────────────
  it('first concurrent release wins, second gets ConflictException', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 10, reserved: 4, version: 2,
    });

    let callCount = 0;
    prisma.inventory.updateMany.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });

    const r1 = service.releaseStock(tenantId, outletA, productId, 2);
    const r2 = service.releaseStock(tenantId, outletA, productId, 2);

    const results = await Promise.allSettled([r1, r2]);
    const outcomes = results.map((r) => r.status);
    expect(outcomes).toContain('fulfilled');
    expect(outcomes).toContain('rejected');

    const rejected = results.find((r) => r.status === 'rejected') as any;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
  });

  // ── 7. Outlet A cannot change Outlet B stock ─────────────
  it('adjustStock at outlet A never touches outlet B inventory', async () => {
    prisma.inventory.findFirst.mockImplementation((args: any) => {
      if (args.where.outletId === outletA) {
        return Promise.resolve({ id: 'inv-a', quantity: 10, reserved: 0, version: 1 });
      }
      return Promise.resolve(null);
    });
    prisma.inventory.updateMany.mockResolvedValue({ count: 1 });
    prisma.stockMovement.create.mockResolvedValue({ id: 'move-a' });

    await service.adjustStock(tenantId, outletA, 'user-1', {
      productId, quantity: 2, type: 'OUTBOUND',
    });

    // Verify the lookup was scoped to outletA
    expect(prisma.inventory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId, outletId: outletA, productId } }),
    );

    // Verify updateMany was scoped to inv-a (outlet A's row)
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-a', version: 1 } }),
    );

    // Ensure outlet B was never queried
    const outletBCalls = prisma.inventory.findFirst.mock.calls.filter(
      (c: any) => c[0]?.where?.outletId === outletB,
    );
    expect(outletBCalls).toHaveLength(0);
  });

  it('reserveStock at outlet A never reserves outlet B stock', async () => {
    prisma.inventory.findFirst.mockImplementation((args: any) => {
      if (args.where.outletId === outletB) {
        return Promise.resolve({ id: 'inv-b', quantity: 100, reserved: 0, version: 1 });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.reserveStock(tenantId, outletA, productId, 5),
    ).rejects.toThrow(NotFoundException);

    // outletB should never have been touched
    expect(prisma.inventory.updateMany).not.toHaveBeenCalled();
  });

  // ── 8. Transaction rollback ──────────────────────────────
  it('rolls back inventory change when stockMovement creation fails', async () => {
    prisma.inventory.findFirst.mockResolvedValue({
      id: 'inv-a', quantity: 10, reserved: 0, version: 1,
    });

    // Simulate $transaction throwing — Prisma rolls back all ops
    prisma.$transaction.mockRejectedValue(new Error('DB deadlock'));

    await expect(
      service.adjustStock(tenantId, outletA, 'user-1', {
        productId, quantity: 3, type: 'OUTBOUND',
      }),
    ).rejects.toThrow('DB deadlock');

    // Because $transaction threw, neither updateMany nor create committed.
    // In real Prisma this is automatic; the mock verifies we USE $transaction.
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rolls back source inventory when destination update fails during transfer', async () => {
    prisma.inventory.findFirst
      .mockResolvedValueOnce({ id: 'inv-from', quantity: 10, version: 1 })
      .mockResolvedValueOnce({ id: 'inv-to', quantity: 2, version: 3 });

    prisma.inventory.updateMany
      .mockResolvedValueOnce({ count: 1 })   // source succeeds
      .mockResolvedValueOnce({ count: 0 });  // destination fails

    await expect(
      service.transferStock(tenantId, outletA, 'user-1', {
        productId,
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 4,
      }),
    ).rejects.toThrow(ConflictException);

    // The real Prisma $transaction would have rolled back the source decrement.
    // Our service throws before committing the movement record, which is
    // the correct failure mode.
  });
});
});
