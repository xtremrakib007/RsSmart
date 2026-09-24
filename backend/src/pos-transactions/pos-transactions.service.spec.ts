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
