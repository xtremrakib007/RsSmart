import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Phase 36B — Failure Path Tests
 *
 * Critical failure scenarios that must be automated.
 */
describe('Failure Tests (Phase 36B)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let tenantId: string;
  let outletId: string;
  let productId: string;
  let sessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
    await prisma.cleanDatabase();

    // Seed a company
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        companyName: 'FailTestCo',
        email: 'owner@failtest.com',
        password: 'Password123!',
        firstName: 'Fail',
        lastName: 'Test',
        phone: '+60129998888',
      })
      .expect(201);

    ownerToken = res.body.accessToken;
    tenantId = res.body.user.tenantId;

    const outlets = await request(app.getHttpServer())
      .get('/outlets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    outletId = outlets.body[0].id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sku: 'FAIL-001', name: 'Fail Product', basePrice: 10 })
      .expect(201);
    productId = product.body.id;

    await request(app.getHttpServer())
      .post('/inventory/adjust')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-outlet-id', outletId)
      .send({ productId, quantity: 5, type: 'INBOUND', notes: 'Initial' })
      .expect(201);

    // POS sales need an open till session.
    const session = await request(app.getHttpServer())
      .post('/pos-sessions/open')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-outlet-id', outletId)
      .send({ deviceId: 'TILL-FAIL', openingCash: 0 })
      .expect(201);
    sessionId = session.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Billing: Payment failure ───────────────────────────
  describe('Billing failures', () => {
    it('rejects checkout for a subscription that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments/checkout/subscription')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ subscriptionId: '00000000-0000-0000-0000-000000000000' });
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── Billing: Expired subscription ────────────────────────
  describe('Subscription failures', () => {
    it('blocks creating outlet when subscription is expired', async () => {
      // Force subscription to expired
      await prisma.subscription.updateMany({
        where: { tenantId },
        data: { status: 'EXPIRED' },
      });

      await request(app.getHttpServer())
        .post('/outlets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ code: 'EXPIRED-OUT', name: 'Should Fail', address: 'Nowhere' })
        .expect(403);

      // Restore for other tests
      await prisma.subscription.updateMany({
        where: { tenantId },
        data: { status: 'TRIALING' },
      });
    });
  });

  // ── POS: Duplicate transaction ───────────────────────────
  describe('POS failures', () => {
    it('a duplicate POS transaction (same clientTransactionId) is not sold twice', async () => {
      const txnId = 'dup-txn-001';
      const sale = {
        sessionId,
        items: [{ productId, quantity: 1, unitPrice: 10 }],
        payments: [{ method: 'CASH', amount: 10 }],
        clientTransactionId: txnId,
      };
      const first = await request(app.getHttpServer())
        .post('/pos-transactions/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(sale)
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/pos-transactions/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(sale)
        .expect(201);
      expect(second.body.receiptNumber).toBe(first.body.receiptNumber);
      expect(await prisma.order.count({ where: { tenantId, clientTransactionId: txnId } })).toBe(1);
      const stock = await prisma.inventory.findFirst({ where: { productId, outletId } });
      expect(Number(stock?.quantity)).toBe(4);
    });

    // ── POS: Insufficient stock ────────────────────────────
    it('rejects POS sale when stock is insufficient', async () => {
      await request(app.getHttpServer())
        .post('/pos-transactions/checkout')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sessionId,
          items: [{ productId, quantity: 999, unitPrice: 10 }],
          payments: [{ method: 'CASH', amount: 9990 }],
          clientTransactionId: 'insufficient-001',
        })
        .expect(400);
    });
  });

  // ── Security: Cross-tenant access ────────────────────────
  describe('Security failures', () => {
    it('rejects access to another tenant\'s data', async () => {
      // Create a second tenant
      const res2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          companyName: 'OtherCo',
          email: 'other@other.com',
          password: 'Password123!',
          firstName: 'Other',
          lastName: 'User',
          phone: '+60127776666',
        })
        .expect(201);

      const otherToken = res2.body.accessToken;

      // Try to access first tenant's outlet with second tenant's token
      await request(app.getHttpServer())
        .get(`/outlets/${outletId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    // ── Security: Cross-outlet access ─────────────────────
    it('rejects staff accessing unauthorized outlet', async () => {
      // Create second outlet
      const outlet2 = await request(app.getHttpServer())
        .post('/outlets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ code: 'OUT2', name: 'Second', address: 'Jalan 2' })
        .expect(201);

      // Invite a cashier to the first outlet only, and sign in as them
      const roles = await request(app.getHttpServer())
        .get('/users/roles/list')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const cashier = roles.body.find((r: any) => r.name === 'cashier');
      const invite = await request(app.getHttpServer())
        .post('/invitations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'staff@failtest.com',
          firstName: 'Staff',
          lastName: 'User',
          outletIds: [outletId],
          roleIds: [cashier.id],
        })
        .expect(201);
      const accepted = await request(app.getHttpServer())
        .post('/invitations/accept')
        .send({ token: invite.body.token, password: 'Password123!' })
        .expect(200);

      // The cashier cannot work at the second outlet
      await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${accepted.body.accessToken}`)
        .set('x-outlet-id', outlet2.body.id)
        .expect(403);
    });
  });

  // ── WhatsApp: Duplicate webhook ──────────────────────────
  describe('WhatsApp failures', () => {
    it('rejects webhook with invalid signature', async () => {
      await request(app.getHttpServer())
        .post('/whatsapp/meta/webhook')
        .set('x-hub-signature-256', 'sha256=invalid')
        .send({ test: true })
        .expect(400);
    });

    it('rejects webhook with missing signature', async () => {
      await request(app.getHttpServer())
        .post('/whatsapp/meta/webhook')
        .send({ test: true })
        .expect(400);
    });
  });
});
