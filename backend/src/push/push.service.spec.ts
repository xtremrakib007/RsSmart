import { Test } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../common/prisma/prisma.service';

const mockSend = jest.fn().mockResolvedValue('message-id');

jest.mock('firebase-admin', () => ({
  apps: [],
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
  messaging: () => ({ send: mockSend }),
}));

describe('PushService', () => {
  let prisma: { deviceToken: Record<string, jest.Mock> };
  const originalEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  async function buildService() {
    const module = await Test.createTestingModule({
      providers: [PushService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return module.get<PushService>(PushService);
  }

  beforeEach(() => {
    prisma = {
      deviceToken: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    mockSend.mockClear();
  });

  afterEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = originalEnv;
  });

  it('is a no-op and never touches the database or firebase-admin when FIREBASE_SERVICE_ACCOUNT is unset', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const service = await buildService();

    await service.sendToUser('tenant-1', 'user-1', { title: 't', body: 'b' });

    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendToDevice does nothing when no token is registered for that deviceId', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
    const service = await buildService();
    prisma.deviceToken.findUnique.mockResolvedValue(null);

    await service.sendToDevice('tenant-1', 'device-abc', { title: 't', body: 'b' });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendToDevice sends to the registered token for that device', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
    const service = await buildService();
    prisma.deviceToken.findUnique.mockResolvedValue({ token: 'fcm-token-123' });

    await service.sendToDevice('tenant-1', 'device-abc', { title: 'Sync Issue', body: 'Conflict' });

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ token: 'fcm-token-123' }));
  });

  it('sendToUser sends to every device the user is registered on', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' });
    const service = await buildService();
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'token-a' }, { token: 'token-b' }]);

    await service.sendToUser('tenant-1', 'rep-1', { title: 'Order Approved', body: 'ORD-1' });

    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
