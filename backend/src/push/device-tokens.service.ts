import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(tenantId: string, userId: string, deviceId: string, token: string, platform = 'ANDROID') {
    return this.prisma.deviceToken.upsert({
      where: { tenantId_deviceId: { tenantId, deviceId } },
      update: { token, userId, platform },
      create: { tenantId, userId, deviceId, token, platform },
    });
  }

  async unregister(tenantId: string, deviceId: string) {
    // Idempotent: unregistering a device that was never registered (or
    // already logged out) is not an error.
    await this.prisma.deviceToken.deleteMany({ where: { tenantId, deviceId } });
    return { success: true };
  }
}
