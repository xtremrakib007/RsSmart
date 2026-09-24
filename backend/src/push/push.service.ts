import { Injectable, Logger } from '@nestjs/common';
import admin from 'firebase-admin';
import { PrismaService } from '../common/prisma/prisma.service';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    this.enabled = !!serviceAccountJson;

    if (this.enabled && admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson!)),
      });
    } else if (!this.enabled) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — push notifications are disabled.');
    }
  }

  async sendToToken(token: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    try {
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (err) {
      this.logger.error(`Failed to send push to token ${token.slice(0, 12)}...`, err as Error);
    }
  }

  /**
   * Sends to every device a specific device (by SyncEvent.clientId) has
   * registered under. Used for sync-conflict alerts, where the sync
   * processor only knows the deviceId, not the userId.
   */
  async sendToDevice(tenantId: string, deviceId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const record = await this.prisma.deviceToken.findUnique({
      where: { tenantId_deviceId: { tenantId, deviceId } },
    });
    if (!record) {
      this.logger.debug(`No registered device token for device ${deviceId} — skipping push.`);
      return;
    }
    await this.sendToToken(record.token, payload);
  }

  /**
   * Sends to every device a user is logged in on (a sales rep may have more
   * than one phone/tablet registered). Used for order approved/assigned.
   */
  async sendToUser(tenantId: string, userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const records = await this.prisma.deviceToken.findMany({
      where: { tenantId, userId },
    });
    if (records.length === 0) {
      this.logger.debug(`No registered device tokens for user ${userId} — skipping push.`);
      return;
    }
    await Promise.all(records.map((r) => this.sendToToken(r.token, payload)));
  }
}
