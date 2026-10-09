import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PosTransactionsService } from './pos-transactions.service';

describe('PosTransactionsService — Idempotency (Phase 25)', () => {
  let service: PosTransactionsService;
  let prisma: any;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const sessionId = 'session-1';
  const clientTransactionId = 'txn-abc-123';
  const productId = 'product-1';
  const customerId = 'customer-1';

  const baseSession = {
    id: sessionId,
    tenantId,
    outletId: 'outlet-1',
    userId,
    status: 'OPEN',
    openingCash: 100,
  };

  const baseProduct = {
    id: productId,
    tenantId,
    name: 'Test Product',
    sku: 'SKU-1',
    basePrice: 10,
    taxRate: 0,
    trackInventory: false,
    isActive: true,
  };

  const baseCustomer = {
    id: customerId,
    tenantId,
    name: 'Test Customer',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      posSession: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn(), create: jest.fn() },
      product: { findMany: jest.fn() },
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      inventory: { findFirst: jest.fn(), update: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
      posCashMovement: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosTransactionsService,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();

    service = module.get<PosTransactionsService>(PosTransactionsService);
    (service as any).prisma = prisma;
  });

  describe('checkout idempotency', () => {
    const checkoutPayload = {
      sessionId,
      clientTransactionId,
      items: [{ productId, quantity: 1, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 10 }],
    };

    beforeEach(() => {
      prisma.posSession.findFirst.mockResolvedValue(baseSession);
      prisma.customer.findFirst.mockResolvedValue(baseCustomer);
      prisma.product.findMany.mockResolvedValue([baseProduct]);
    });

    it('should return existing receipt when clientTransactionId already exists', async () => {
      const existingOrder = {
        id: 'order-1',
        tenantId,
        orderNumber: 'POS-202408-00001',
        source: 'POS',
      };

      prisma.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.checkout(tenantId, userId, checkoutPayload);

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { tenantId_clientTransactionId: { tenantId, clientTransactionId } },
      });
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(result.receiptNumber).toBe(existingOrder.orderNumber);
    });

    it('should create a new order when clientTransactionId is new', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      prisma.order.create.mockResolvedValue({
        id: 'order-new',
        tenantId,
        orderNumber: 'POS-202408-00002',
      });
      prisma.order.count.mockResolvedValue(1);

      const result = await service.checkout(tenantId, userId, checkoutPayload);

      expect(prisma.order.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle race condition by catching P2002 and returning existing order', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'order-race',
          tenantId,
          orderNumber: 'POS-202408-00003',
        });

      const dbError = new Error('Unique constraint failed');
      (dbError as any).code = 'P2002';
      prisma.$transaction.mockRejectedValue(dbError);

      const result = await service.checkout(tenantId, userId, checkoutPayload);

      expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);
      expect(result.receiptNumber).toBe('POS-202408-00003');
    });
  });
});


describe('PosTransactionsService — Concurrent Stock Deduction (Phase 26)', () => {
  let service: PosTransactionsService;
  let prisma: any;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const sessionId = 'session-1';
  const productId = 'product-1';
  const customerId = 'customer-1';

  const baseSession = {
    id: sessionId,
    tenantId,
    outletId: 'outlet-1',
    userId,
    status: 'OPEN',
    openingCash: 100,
  };

  const baseProduct = {
    id: productId,
    tenantId,
    name: 'Test Product',
    sku: 'SKU-1',
    basePrice: 10,
    taxRate: 0,
    trackInventory: true,
    isActive: true,
  };

  const baseCustomer = {
    id: customerId,
    tenantId,
    name: 'Test Customer',
    isActive: true,
  };

  const baseInventory = {
    id: 'inv-1',
    tenantId,
    outletId: 'outlet-1',
    productId,
    quantity: 5,
    reserved: 0,
    version: 1,
  };

  beforeEach(async () => {
    prisma = {
      posSession: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn(), create: jest.fn() },
      product: { findMany: jest.fn() },
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      inventory: { findFirst: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
      posCashMovement: { create: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosTransactionsService,
        { provide: 'PrismaService', useValue: prisma },
      ],
    }).compile();

    service = module.get<PosTransactionsService>(PosTransactionsService);
    (service as any).prisma = prisma;
  });

  const checkoutPayload = {
    sessionId,
    items: [{ productId, quantity: 3, unitPrice: 10 }],
    payments: [{ method: 'CASH', amount: 30 }],
  };

  beforeEach(() => {
    prisma.posSession.findFirst.mockResolvedValue(baseSession);
    prisma.customer.findFirst.mockResolvedValue(baseCustomer);
    prisma.product.findMany.mockResolvedValue([baseProduct]);
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue({ id: 'order-1', tenantId, orderNumber: 'POS-001' });
    prisma.order.count.mockResolvedValue(1);
  });

  it('should atomically deduct stock using raw SQL check-and-decrement', async () => {
    prisma.inventory.findFirst.mockResolvedValue(baseInventory);
    prisma.$queryRaw.mockResolvedValue([{ id: 'inv-1' }]);

    await service.checkout(tenantId, userId, checkoutPayload);

    expect(prisma.$queryRaw).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      3,
      'inv-1',
      3,
    );
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUTBOUND',
          quantity: 3,
          referenceType: 'POS_ORDER',
        }),
      }),
    );
  });

  it('should reject sale when atomic check-and-deduct returns zero rows (insufficient stock)', async () => {
    prisma.inventory.findFirst.mockResolvedValue(baseInventory);
    prisma.$queryRaw.mockResolvedValue([]); // stock ran out

    await expect(service.checkout(tenantId, userId, checkoutPayload)).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('should not create stock movement when atomic deduction fails', async () => {
    prisma.inventory.findFirst.mockResolvedValue({ ...baseInventory, quantity: 2 });
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.checkout(tenantId, userId, checkoutPayload)).rejects.toThrow(
      'Insufficient stock for Test Product. Available: 2',
    );
  });
});

describe('PosTransactionsService — Checkout validation hardening', () => {
  let service: PosTransactionsService;
  let prisma: any;
  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const sessionId = 'session-1';
  const productId = 'product-1';

  beforeEach(() => {
    prisma = {
      posSession: { findFirst: jest.fn().mockResolvedValue({ id: sessionId, outletId: 'outlet-1', status: 'OPEN' }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'customer-1', isActive: true }), create: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([{ id: productId, name: 'Test', basePrice: 10, taxRate: 0, trackInventory: false }]) },
      order: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), count: jest.fn() },
      inventory: { findFirst: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
      posCashMovement: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new PosTransactionsService({} as any);
    (service as any).prisma = prisma;
  });

  const payload = (overrides: any = {}) => ({
    sessionId,
    items: [{ productId, quantity: 1, unitPrice: 0 }],
    payments: [{ method: 'CASH', amount: 10 }],
    ...overrides,
  });

  it('rejects client payloads that contain more than 100 items', async () => {
    await expect(service.checkout(tenantId, userId, payload({
      items: Array.from({ length: 101 }, () => ({ productId, quantity: 1 })),
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('rejects discounts that exceed the catalog-priced subtotal', async () => {
    await expect(service.checkout(tenantId, userId, payload({
      items: [{ productId, quantity: 1, unitPrice: 0, discount: 10.01 }],
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects payments greater than the server-calculated total', async () => {
    await expect(service.checkout(tenantId, userId, payload({
      payments: [{ method: 'CASH', amount: 10.01 }],
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rejects non-boolean allowCredit values rather than treating strings as approval', async () => {
    await expect(service.checkout(tenantId, userId, payload({
      allowCredit: 'false',
      payments: [],
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});


describe('PosTransactionsService — Refund safety', () => {
  let service: PosTransactionsService;
  let prisma: any;
  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const orderId = 'order-1';
  const sessionId = 'session-1';
  const order = {
    id: orderId, tenantId, source: 'POS', status: 'APPROVED', outletId: 'outlet-1',
    orderNumber: 'POS-202610-00001', paidAmount: 20,
    items: [{ productId: 'product-1', quantity: 2 }],
  };

  beforeEach(() => {
    prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      posSession: { findFirst: jest.fn().mockResolvedValue({ id: sessionId, outletId: 'outlet-1' }) },
      inventory: { findFirst: jest.fn().mockResolvedValue({ id: 'inventory-1' }), update: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
      posCashMovement: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    service = new PosTransactionsService({} as any);
    (service as any).prisma = prisma;
  });

  it('rejects partial refunds because this flow restores all items and closes the sale', async () => {
    await expect(service.refund(tenantId, userId, orderId, { sessionId, amount: 10 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.inventory.update).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, 0, -1, 20.001])('rejects invalid refund amount %s', async amount => {
    await expect(service.refund(tenantId, userId, orderId, { sessionId, amount }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not mutate inventory or create payment if another refund already claimed the order', async () => {
    prisma.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refund(tenantId, userId, orderId, { sessionId }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.inventory.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
