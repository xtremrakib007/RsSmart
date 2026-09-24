import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { SyncQueueService } from '../../src/common/queue/sync-queue.service';

describe('Sync E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queueService: SyncQueueService;
  let authToken: string;
  let tenantId: string;
  const clientId = 'test-device-001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    queueService = moduleFixture.get<SyncQueueService>(SyncQueueService);

    // Clean database
    await prisma.cleanDatabase();

    // Seed minimal data
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant', slug: 'test-tenant' },
    });
    tenantId = tenant.id;

    const hashedPassword = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6'; // password123
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: 'test@sync.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@sync.com', password: 'password123', tenantId });

    authToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sync/push', () => {
    it('should queue sync events for processing', async () => {
      const events = [
        {
          eventId: 'evt-001',
          entityType: 'customer',
          entityId: 'cust-001',
          action: 'CREATE',
          payload: {
            name: 'Test Customer',
            email: 'test@customer.com',
            phone: '+1234567890',
          },
          vectorClock: { [clientId]: 1 },
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clientId, events })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('PENDING');
    });

    it('should handle delta updates', async () => {
      // First create a customer
      const customer = await prisma.customer.create({
        data: { tenantId, name: 'Original Name', email: 'original@test.com' },
      });

      const events = [
        {
          eventId: 'evt-002',
          entityType: 'customer',
          entityId: customer.id,
          action: 'UPDATE',
          payload: { name: 'Updated Name' },
          isDelta: true,
          vectorClock: { [clientId]: 2 },
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clientId, events })
        .expect(200);

      expect(response.body.data[0].status).toBe('PENDING');
    });
  });

  describe('POST /sync/pull', () => {
    it('should return events since last sync', async () => {
      // Create a completed event from another client
      await prisma.syncEvent.create({
        data: {
          tenantId,
          clientId: 'other-device',
          eventType: 'customer.CREATE',
          entityType: 'customer',
          entityId: 'cust-server',
          action: 'CREATE',
          payload: { name: 'Server Customer' },
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      const response = await request(app.getHttpServer())
        .post('/sync/pull')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId,
          lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
          deltaOnly: true,
        })
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /sync/status', () => {
    it('should return client sync status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/sync/status?clientId=${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.clientId).toBe(clientId);
      expect(response.body.data).toHaveProperty('pendingEvents');
      expect(response.body.data).toHaveProperty('failedEvents');
    });
  });

  describe('GET /sync-health/dashboard', () => {
    it('should return sync health dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/sync-health/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('deviceStats');
      expect(response.body.data).toHaveProperty('alerts');
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect duplicate events', async () => {
      // Create an existing completed event
      await prisma.syncEvent.create({
        data: {
          tenantId,
          clientId: 'other-device',
          eventType: 'order.CREATE',
          entityType: 'order',
          entityId: 'order-dup',
          action: 'CREATE',
          payload: { total: 100 },
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      // Try to create same entity from different client
      const events = [
        {
          eventId: 'evt-dup',
          entityType: 'order',
          entityId: 'order-dup',
          action: 'CREATE',
          payload: { total: 200 },
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/sync/push')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clientId: 'new-device', events })
        .expect(200);

      // Event should be queued, processor will handle conflict
      expect(response.body.data[0].status).toBe('PENDING');
    });
  });

  describe('Queue Management', () => {
    it('should retry failed events', async () => {
      // Create a failed event
      const failedEvent = await prisma.syncEvent.create({
        data: {
          tenantId,
          clientId,
          eventType: 'test.FAIL',
          entityType: 'test',
          entityId: 'fail-001',
          action: 'CREATE',
          payload: {},
          status: 'FAILED',
          error: 'Test failure',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/sync-health/retry-failed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.retried).toBeGreaterThanOrEqual(1);
    });
  });
});
