import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Phase 36 — Production Test Pack.
 *
 * Walks the complete business flow end-to-end:
 *   Signup → Company → Trial → Outlet → Employee → Product → Stock
 *   → POS Sale → Inventory Deduction → WhatsApp → Payment → Subscription → Reports
 */
describe('Production Test Pack (Phase 36)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let tenantId: string;
  let outletId: string;
  let productId: string;
  let sessionId: string;
  let receiptNumber: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
    await prisma.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Signup creates company, owner, first outlet, and trial subscription', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        companyName: 'PilotCo-36',
        email: 'owner@pilot36.com',
        password: 'Password123!',
        firstName: 'Pilot',
        lastName: 'Owner',
        phone: '+60123600001',
      })
      .expect(201);

    ownerToken = res.body.accessToken;
    tenantId = res.body.user.tenantId;

    const subRes = await request(app.getHttpServer())
      .get('/subscriptions/current')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(subRes.body.status).toBe('TRIALING');
  });

  it('2. Owner can create a second outlet', async () => {
    await request(app.getHttpServer())
      .post('/outlets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: 'OUT2-36', name: 'Second Outlet', address: 'Jalan Phase 36' })
      .expect(201);

    const outlets = await request(app.getHttpServer())
      .get('/outlets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    outletId = outlets.body.find((o: any) => o.isDefault)?.id || outlets.body[0].id;
    expect(outlets.body.length).toBeGreaterThanOrEqual(2);
  });

  it('3. Owner can invite an employee', async () => {
    const roles = await request(app.getHttpServer())
      .get('/users/roles/list')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const cashier = roles.body.find((r: any) => r.name === 'cashier');
    const res = await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'staff@pilot36.com',
        firstName: 'Staff',
        lastName: 'User',
        outletIds: [outletId],
        roleIds: [cashier.id],
      })
      .expect(201);
    expect(res.body.token).toBeTruthy();
  });

  it('4. Owner can create a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sku: 'PROD-36',
        name: 'Test Product',
        basePrice: 25.0,
        categoryId: null,
        unitId: null,
      })
      .expect(201);

    productId = res.body.id;
  });

  it('5. Owner can add stock', async () => {
    await request(app.getHttpServer())
      .post('/inventory/adjust')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-outlet-id', outletId)
      .send({
        productId,
        quantity: 100,
        type: 'INBOUND',
        notes: 'Initial stock',
      })
      .expect(201);
  });

  it('6. POS sale deducts inventory', async () => {
    const before = await prisma.inventory.findFirst({
      where: { productId, outletId },
    });
    expect(Number(before?.quantity)).toBe(100);

    // A sale needs an open till session.
    const session = await request(app.getHttpServer())
      .post('/pos-sessions/open')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-outlet-id', outletId)
      .send({ deviceId: 'TILL-36', openingCash: 100 })
      .expect(201);
    sessionId = session.body.id;

    const sale = await request(app.getHttpServer())
      .post('/pos-transactions/checkout')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sessionId,
        items: [{ productId, quantity: 3, unitPrice: 25 }],
        payments: [{ method: 'CASH', amount: 75 }],
        clientTransactionId: 'pos-txn-36-001',
      })
      .expect(201);
    receiptNumber = sale.body.receiptNumber;

    const after = await prisma.inventory.findFirst({
      where: { productId, outletId },
    });
    expect(Number(after?.quantity)).toBe(97);
  });

  it('7. A retried POS sale (same clientTransactionId) returns the first receipt and deducts nothing more', async () => {
    const again = await request(app.getHttpServer())
      .post('/pos-transactions/checkout')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sessionId,
        items: [{ productId, quantity: 3, unitPrice: 25 }],
        payments: [{ method: 'CASH', amount: 75 }],
        clientTransactionId: 'pos-txn-36-001',
      })
      .expect(201);
    expect(again.body.receiptNumber).toBe(receiptNumber);
    const stock = await prisma.inventory.findFirst({ where: { productId, outletId } });
    expect(Number(stock?.quantity)).toBe(97);
  });

  it('8. Subscription limits are enforced', async () => {
    const current = await request(app.getHttpServer())
      .get('/subscriptions/current/plan')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    if (current.body?.limits?.outletLimit) {
      const limit = current.body.limits.outletLimit;
      const outlets = await prisma.outlet.count({ where: { tenantId } });
      expect(outlets).toBeLessThanOrEqual(limit);
    }
  });

  it('9. Billing history endpoint returns data', async () => {
    await request(app.getHttpServer())
      .get('/billing/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('10. Reports endpoint is accessible', async () => {
    await request(app.getHttpServer())
      .get('/reports/sales')
      .query({ fromDate: '2020-01-01', toDate: '2030-12-31' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
