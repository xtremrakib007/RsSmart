import { CustomersService } from './customers.service';

describe('CustomersService tenant isolation and data minimization', () => {
  let service: CustomersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'customer-1', tenantId: 'tenant-1', name: 'Example', isActive: true,
          orders: [], visits: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      customerVisit: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CustomersService(prisma);
  });

  it('filters nested customer orders by tenant and selects only report/list fields', async () => {
    await service.findAll('tenant-1');

    const query = prisma.customer.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ tenantId: 'tenant-1', isActive: true });
    expect(query.include.orders.where).toEqual({ tenantId: 'tenant-1' });
    expect(query.include.orders.select).toEqual({
      id: true, orderNumber: true, status: true, total: true,
      paidAmount: true, balanceDue: true, createdAt: true,
    });
  });

  it('updates only the matching tenant customer atomically', async () => {
    await service.update('customer-1', 'tenant-1', { name: 'Updated', tenantId: 'tenant-2', balance: 999 });

    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1', tenantId: 'tenant-1' },
      data: { name: 'Updated' },
    });
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'customer-1', tenantId: 'tenant-1' },
    }));
  });

  it('returns not found when a tenant-scoped update matches no customer', async () => {
    prisma.customer.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.update('customer-foreign', 'tenant-1', { name: 'Tamper' }))
      .rejects.toThrow('Customer not found');
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('deactivates only a tenant-scoped customer without a find-then-update race', async () => {
    await service.remove('customer-1', 'tenant-1');

    expect(prisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1', tenantId: 'tenant-1' },
      data: { isActive: false },
    });
  });

  it('does not reveal whether a foreign-tenant customer exists during deactivation', async () => {
    prisma.customer.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.remove('customer-foreign', 'tenant-1')).rejects.toThrow('Customer not found');
  });
});
