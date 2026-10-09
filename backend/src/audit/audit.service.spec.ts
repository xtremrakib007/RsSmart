import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AuditService security', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuditService>(AuditService);
  });

  it('redacts secret-like fields before persisting audit snapshots', async () => {
    await service.log({
      tenantId: 'tenant-1',
      action: 'UPDATE',
      entityType: 'User',
      entityId: 'user-1',
      newValues: {
        displayName: 'Example',
        password: 'do-not-store',
        refreshToken: 'also-secret',
        nested: { api_key: 'secret-key' },
      },
    });

    const saved = prisma.auditLog.create.mock.calls[0][0].data;
    expect(saved.newValues).toEqual({
      displayName: 'Example',
      password: '[REDACTED]',
      refreshToken: '[REDACTED]',
      nested: { api_key: '[REDACTED]' },
    });
  });

  it('caps audit log queries at 100 records and selects only safe user fields', async () => {
    await service.getLogs('tenant-1');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }));
  });

  it('rejects invalid or inverted date ranges', async () => {
    await expect(service.getLogs('tenant-1', { fromDate: 'invalid-date' }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getLogs('tenant-1', {
      fromDate: '2026-02-01', toDate: '2026-01-01',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
