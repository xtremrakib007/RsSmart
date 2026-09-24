import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { seedTenant, TestTenant } from './helpers';

describe('Tenant Isolation (Phase 24)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    tenantA = await seedTenant(app, 'A');
    tenantB = await seedTenant(app, 'B');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cross-tenant IDOR: Orders', () => {
    it('should NOT let Tenant A read Tenant B order', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${tenantB.orderId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });

    it('should NOT let Tenant A update Tenant B order status', async () => {
      await request(app.getHttpServer())
        .put(`/orders/${tenantB.orderId}/status`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ status: 'CANCELLED' })
        .expect(404);
    });

    it('should NOT let Tenant A add payment to Tenant B order', async () => {
      await request(app.getHttpServer())
        .post(`/orders/${tenantB.orderId}/payments`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ amount: 10, method: 'CASH' })
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: Products', () => {
    it('should NOT let Tenant A read Tenant B product', async () => {
      await request(app.getHttpServer())
        .get(`/products/${tenantB.productId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });

    it('should NOT let Tenant A update Tenant B product', async () => {
      await request(app.getHttpServer())
        .put(`/products/${tenantB.productId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: Customers', () => {
    it('should NOT let Tenant A read Tenant B customer', async () => {
      await request(app.getHttpServer())
        .get(`/customers/${tenantB.customerId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });

    it('should NOT let Tenant A update Tenant B customer', async () => {
      await request(app.getHttpServer())
        .put(`/customers/${tenantB.customerId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: Outlets', () => {
    it('should NOT let Tenant A read Tenant B outlet', async () => {
      await request(app.getHttpServer())
        .get(`/outlets/${tenantB.outletId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });

    it('should NOT let Tenant A update Tenant B outlet', async () => {
      await request(app.getHttpServer())
        .patch(`/outlets/${tenantB.outletId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });

    it('should NOT let Tenant A list Tenant B outlet users', async () => {
      await request(app.getHttpServer())
        .get(`/outlets/${tenantB.outletId}/users`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: Users', () => {
    it('should NOT let Tenant A read Tenant B user', async () => {
      const usersB = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const targetUserId = usersB.body[0].id;

      await request(app.getHttpServer())
        .get(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });

    it('should NOT let Tenant A disable Tenant B user', async () => {
      const usersB = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const targetUserId = usersB.body[0].id;

      await request(app.getHttpServer())
        .patch(`/users/${targetUserId}/disable`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: POS Sessions', () => {
    it('should NOT let Tenant A close Tenant B session', async () => {
      const openRes = await request(app.getHttpServer())
        .post('/pos-sessions/open')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .set('x-outlet-id', tenantB.outletId)
        .send({ deviceId: 'DEVICE-B', openingCash: 100 })
        .expect(201);

      const sessionId = openRes.body.id;

      await request(app.getHttpServer())
        .put(`/pos-sessions/${sessionId}/close`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ closingCash: 100 })
        .expect(404);
    });
  });

  describe('Cross-tenant IDOR: Reports', () => {
    it('should not leak revenue between tenants', async () => {
      const reportA = await request(app.getHttpServer())
        .get('/reports/sales')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .query({ fromDate: '2020-01-01', toDate: '2030-12-31' })
        .expect(200);

      const reportB = await request(app.getHttpServer())
        .get('/reports/sales')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .query({ fromDate: '2020-01-01', toDate: '2030-12-31' })
        .expect(200);

      expect(reportA.body.totalRevenue).not.toBe(reportB.body.totalRevenue);
    });
  });

  describe('Cross-tenant IDOR: Upload', () => {
    it('should NOT let Tenant A delete Tenant B uploaded file', async () => {
      const uploadRes = await request(app.getHttpServer())
        .post('/upload/invoices')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .attach('file', Buffer.from('test content'), 'invoice.pdf')
        .expect(201);

      const filename = uploadRes.body.filename;

      await request(app.getHttpServer())
        .delete(`/upload/${encodeURIComponent(filename)}`)
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/upload/${encodeURIComponent(filename)}`)
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);
    });

    it('should NOT let Tenant A get URL for Tenant B file', async () => {
      const uploadRes = await request(app.getHttpServer())
        .post('/upload/invoices')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .attach('file', Buffer.from('test content'), 'invoice.pdf')
        .expect(201);

      const filename = uploadRes.body.filename;

      await request(app.getHttpServer())
        .post('/upload/url')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .send({ filename })
        .expect(403);
    });
  });

  describe('Cross-tenant IDOR: Subscriptions', () => {
    it('should NOT let Tenant A see Tenant B subscription', async () => {
      const subA = await request(app.getHttpServer())
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(200);

      const subB = await request(app.getHttpServer())
        .get('/subscriptions/current')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      expect(subA.body.id).not.toBe(subB.body.id);
      expect(subA.body.tenantId).toBe(tenantA.tenantId);
      expect(subB.body.tenantId).toBe(tenantB.tenantId);
    });
  });

  describe('Filter manipulation', () => {
    it('should return empty when Tenant A queries with Tenant B outletId', async () => {
      const orders = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .query({ outletId: tenantB.outletId })
        .expect(200);

      expect(orders.body).toEqual([]);
    });

    it('should return empty when Tenant A queries with Tenant B customerId', async () => {
      const orders = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .query({ customerId: tenantB.customerId })
        .expect(200);

      expect(orders.body).toEqual([]);
    });
  });

  describe('List endpoints must never leak other tenants', () => {
    it('should only list Tenant A products, not B', async () => {
      const aProducts = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(200);

      const bProducts = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const aIds = aProducts.body.map((p: any) => p.id);
      const bIds = bProducts.body.map((p: any) => p.id);

      expect(aIds).not.toEqual(expect.arrayContaining(bIds));
      expect(bIds).not.toEqual(expect.arrayContaining(aIds));
    });

    it('should only list Tenant A customers, not B', async () => {
      const aCustomers = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(200);

      const bCustomers = await request(app.getHttpServer())
        .get('/customers')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const aIds = aCustomers.body.map((c: any) => c.id);
      const bIds = bCustomers.body.map((c: any) => c.id);

      expect(aIds).not.toEqual(expect.arrayContaining(bIds));
    });

    it('should only list Tenant A outlets, not B', async () => {
      const aOutlets = await request(app.getHttpServer())
        .get('/outlets')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(200);

      const bOutlets = await request(app.getHttpServer())
        .get('/outlets')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const aIds = aOutlets.body.map((o: any) => o.id);
      const bIds = bOutlets.body.map((o: any) => o.id);

      expect(aIds).not.toEqual(expect.arrayContaining(bIds));
    });

    it('should only list Tenant A users, not B', async () => {
      const aUsers = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tenantA.ownerToken}`)
        .expect(200);

      const bUsers = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tenantB.ownerToken}`)
        .expect(200);

      const aIds = aUsers.body.map((u: any) => u.id);
      const bIds = bUsers.body.map((u: any) => u.id);

      expect(aIds).not.toEqual(expect.arrayContaining(bIds));
    });
  });
});
