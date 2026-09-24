import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { seedTenant, TestTenant } from '../security/helpers';

describe('Offline Sync Hardening (Phase 27)', () => {
  let app: INestApplication;
  let tenant: TestTenant;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tenant = await seedTenant(app, 'SYNC');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Offline sale → reconnect → sync', () => {
    it('should accept an offline sale push and return per-event results', async () => {
      const pushRes = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          clientId: 'DEVICE-OFFLINE-1',
          events: [
            {
              entityType: 'order',
              action: 'CREATE',
              entityId: 'local-order-1',
              payload: {
                clientTransactionId: 'offline-txn-001',
                customerId: tenant.customerId,
                items: [{ productId: tenant.productId, quantity: 1, unitPrice: 10 }],
                total: 10,
              },
              vectorClock: { 'DEVICE-OFFLINE-1': 1 },
            },
          ],
        })
        .expect(200);

      expect(pushRes.body).toHaveLength(1);
      expect(pushRes.body[0].status).toBe('created');
      expect(pushRes.body[0].eventId).toBeDefined();
    });

    it('should deduplicate when the same offline sale is pushed again', async () => {
      const event = {
        entityType: 'order',
        action: 'CREATE',
        entityId: 'local-order-2',
        payload: {
          clientTransactionId: 'offline-txn-002',
          customerId: tenant.customerId,
          items: [{ productId: tenant.productId, quantity: 1, unitPrice: 10 }],
          total: 10,
        },
        vectorClock: { 'DEVICE-OFFLINE-1': 2 },
      };

      // First push
      const push1 = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({ clientId: 'DEVICE-OFFLINE-1', events: [event] })
        .expect(200);

      expect(push1.body[0].status).toBe('created');
      const eventId = push1.body[0].eventId;

      // Second push (network retry)
      const push2 = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({ clientId: 'DEVICE-OFFLINE-1', events: [event] })
        .expect(200);

      expect(push2.body[0].status).toBe('duplicate');
      expect(push2.body[0].eventId).toBe(eventId);
    });

    it('should not duplicate-pull events that have been acked', async () => {
      // Push an event from another device
      const pushRes = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          clientId: 'DEVICE-OTHER',
          events: [
            {
              entityType: 'customer',
              action: 'CREATE',
              entityId: 'local-cust-1',
              payload: { name: 'Offline Customer', phone: '+60111111111' },
              vectorClock: { 'DEVICE-OTHER': 1 },
            },
          ],
        })
        .expect(200);

      const eventId = pushRes.body[0].eventId;

      // Pull as the first device
      const pull1 = await request(app.getHttpServer())
        .post('/sync/pull')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          clientId: 'DEVICE-OFFLINE-1',
          lastSyncAt: '2020-01-01T00:00:00Z',
        })
        .expect(200);

      expect(pull1.body.length).toBeGreaterThan(0);
      const pulledIds = pull1.body.map((e: any) => e.id);
      expect(pulledIds).toContain(eventId);

      // Ack the events
      await request(app.getHttpServer())
        .post('/sync/ack')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          clientId: 'DEVICE-OFFLINE-1',
          eventIds: pulledIds,
        })
        .expect(200);

      // Pull again with same lastSyncAt — should get nothing new
      const pull2 = await request(app.getHttpServer())
        .post('/sync/pull')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .send({
          clientId: 'DEVICE-OFFLINE-1',
          lastSyncAt: '2020-01-01T00:00:00Z',
        })
        .expect(200);

      expect(pull2.body).toEqual([]);
    });

    it('should report sync status including acked count', async () => {
      const statusRes = await request(app.getHttpServer())
        .get('/sync/status')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .query({ clientId: 'DEVICE-OFFLINE-1' })
        .expect(200);

      expect(statusRes.body.clientId).toBe('DEVICE-OFFLINE-1');
      expect(typeof statusRes.body.ackedEvents).toBe('number');
      expect(typeof statusRes.body.isHealthy).toBe('boolean');
    });
  });

  describe('Failed sync handling', () => {
    it('should list failed events for admin review', async () => {
      const failedRes = await request(app.getHttpServer())
        .get('/sync/failed')
        .set('Authorization', `Bearer ${tenant.ownerToken}`)
        .expect(200);

      expect(Array.isArray(failedRes.body.events)).toBe(true);
      expect(typeof failedRes.body.total).toBe('number');
    });
  });
});
