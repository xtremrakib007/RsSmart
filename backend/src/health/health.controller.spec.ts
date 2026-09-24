import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../common/prisma/prisma.service';

// ioredis is mocked so this test never opens a real socket.
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    status: 'ready',
    connect: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  }));
});

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok when the database and redis both respond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.ok).toBe(true);
    expect(result.checks.redis.ok).toBe(true);
  });

  it('throws ServiceUnavailable when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
