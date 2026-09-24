import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { seedTenant, TestTenant } from './helpers';

describe('Outlet Isolation (Phase 24)', () => {
  let app: INestApplication;
  let tenant: TestTenant;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenant = await seedTenant(app, 'OUTLET');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Staff scoped to one outlet cannot access another', () => {
    it('should block staff from inventory at unauthorized outlet', async () => {
      await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${tenant.staffToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .expect(403);
    });

    it('should block staff from creating order at unauthorized outlet', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tenant.staffToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .send({
          customerId: tenant.customerId,
          items: [{ productId: tenant.productId, quantity: 1, unitPrice: 10 }],
        })
        .expect(403);
    });

    it('should block staff from opening POS session at unauthorized outlet', async () => {
      await request(app.getHttpServer())
        .post('/pos-sessions/open')
        .set('Authorization', `Bearer ${tenant.staffToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .send({ deviceId: 'DEV-1', openingCash: 100 })
        .expect(403);
    });

    it('should allow staff to access their assigned outlet inventory', async () => {
      await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${tenant.staffToken}`)
        .set('x-outlet-id', tenant.outletId)
        .expect(200);
    });
  });

  describe('Manager can access any outlet', () => {
    it('should allow manager to access any outlet inventory', async () => {
      await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${tenant.managerToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .expect(200);
    });

    it('should allow manager to create order at any outlet', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tenant.managerToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .send({
          customerId: tenant.customerId,
          items: [{ productId: tenant.productId, quantity: 1, unitPrice: 10 }],
        })
        .expect(201);
    });
  });

  describe('Outlet-scoped list endpoints must not leak other outlet data', () => {
    it('should only show inventory for the requested outlet', async () => {
      await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.outletId)
        .send({ productId: tenant.productId, quantity: 100, reason: 'Initial stock' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/inventory/adjust')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .send({ productId: tenant.productId, quantity: 50, reason: 'Initial stock' })
        .expect(201);

      const outlet1Stock = await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.outletId)
        .expect(200);

      const outlet2Stock = await request(app.getHttpServer())
        .get('/inventory')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .expect(200);

      const qty1 = outlet1Stock.body.find((s: any) => s.productId === tenant.productId)?.quantity;
      const qty2 = outlet2Stock.body.find((s: any) => s.productId === tenant.productId)?.quantity;

      expect(qty1).toBe(100);
      expect(qty2).toBe(50);
      expect(qty1).not.toBe(qty2);
    });

    it('should only list sessions for the requested outlet', async () => {
      const s1 = await request(app.getHttpServer())
        .post('/pos-sessions/open')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.outletId)
        .send({ deviceId: 'DEV-OUT1', openingCash: 100 })
        .expect(201);

      const s2 = await request(app.getHttpServer())
        .post('/pos-sessions/open')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .set('x-outlet-id', tenant.secondOutletId)
        .send({ deviceId: 'DEV-OUT2', openingCash: 200 })
        .expect(201);

      const sessions1 = await request(app.getHttpServer())
        .get('/pos-sessions')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .query({ outletId: tenant.outletId })
        .expect(200);

      const sessions2 = await request(app.getHttpServer())
        .get('/pos-sessions')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .query({ outletId: tenant.secondOutletId })
        .expect(200);

      const ids1 = sessions1.body.map((s: any) => s.id);
      const ids2 = sessions2.body.map((s: any) => s.id);

      expect(ids1).toContain(s1.body.id);
      expect(ids1).not.toContain(s2.body.id);
      expect(ids2).toContain(s2.body.id);
      expect(ids2).not.toContain(s1.body.id);
    });
  });
});
