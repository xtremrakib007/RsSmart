import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('NotificationsGateway');
  private userSockets: Map<string, string[]> = new Map();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.query.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: process.env.JWT_SECRET,
      });

      client.data.user = payload;
      client.data.tenantId = payload.tenantId;
      client.join(`tenant:${payload.tenantId}`);

      const userSockets = this.userSockets.get(payload.sub) || [];
      userSockets.push(client.id);
      this.userSockets.set(payload.sub, userSockets);

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (error) {
      this.logger.error('Connection failed', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.sub;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const updated = sockets.filter((id) => id !== client.id);
      if (updated.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, updated);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, room: string) {
    client.join(room);
    return { status: 'subscribed', room };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, room: string) {
    client.leave(room);
    return { status: 'unsubscribed', room };
  }

  // Methods to be called from other services
  notifyTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  notifyUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
