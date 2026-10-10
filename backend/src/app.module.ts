import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosSessionsModule } from './pos-sessions/pos-sessions.module';
import { ReportsModule } from './reports/reports.module';
import { UploadModule } from './upload/upload.module';
import { SyncModule } from './sync/sync.module';
import { AuditModule } from './audit/audit.module';
import { WebsocketModule } from './websocket/websocket.module';
import { QueueModule } from './common/queue/queue.module';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { PushModule } from './push/push.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { SalesModule } from './sales/sales.module';
import { PosTransactionsModule } from './pos-transactions/pos-transactions.module';
import { TenantsModule } from './tenants/tenants.module';
import { OutletsModule } from './outlets/outlets.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PaymentsModule } from './payments/payments.module';
import { BillingModule } from './billing/billing.module';
import { LegalPoliciesModule } from './legal-policies/legal-policies.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Default: 100 req / 60s per client. Matches nginx-prod's `api` zone
        // as a second line of defense for traffic that reaches the API
        // directly (pod-to-pod in k8s, local dev, nginx misconfig).
        ttl: 60_000,
        limit: 100,
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    PrismaModule,
    CommonModule,
    QueueModule,
    HealthModule,
    PushModule,
    WhatsAppModule,
    SalesModule,
    PosTransactionsModule,
    TenantsModule,
    SubscriptionsModule,
    EntitlementsModule,
    PaymentsModule,
    BillingModule,
    LegalPoliciesModule,
    AuthModule,
    UsersModule,
    InvitationsModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    InventoryModule,
    PosSessionsModule,
    OutletsModule,
    ReportsModule,
    UploadModule,
    SyncModule,
    AuditModule,
    WebsocketModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Order matters: JwtAuthGuard populates request.user first; RolesGuard
    // and PermissionsGuard both read it. All three bypass routes marked
    // with @Public(). Every route requires a valid, non-revoked JWT by
    // default now — previously neither guard was registered globally, so
    // @Roles(...) was silently unenforced everywhere it was used (Phase 12
    // finding), and forgetting a per-controller @UseGuards(AuthGuard('jwt'))
    // (as the old public /auth/register effectively relied on for safety
    // elsewhere) left a route open by accident rather than by decision.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
