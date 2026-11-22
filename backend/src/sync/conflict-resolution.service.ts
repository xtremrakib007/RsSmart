import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ConflictCheck {
  hasConflict: boolean;
  type?: 'concurrent_edit' | 'stock_unavailable' | 'version_mismatch' | 'duplicate';
  details?: any;
  serverVersion?: any;
}

export interface ResolutionResult {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual_review';
  resolvedData?: any;
  message: string;
}

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  constructor(private prisma: PrismaService) {}

  async checkConflict(event: any): Promise<ConflictCheck> {
    const { entityType, entityId, action, payload, clientId } = event;

    // Check 1: Duplicate event (idempotency)
    const existing = await this.prisma.syncEvent.findFirst({
      where: {
        entityType,
        entityId,
        status: 'COMPLETED',
        clientId: { not: clientId },
      },
    });

    if (existing && action === 'CREATE') {
      return {
        hasConflict: true,
        type: 'duplicate',
        details: { existingEventId: existing.id, createdAt: existing.createdAt },
      };
    }

    // Check 2: Stock availability for orders
    if (entityType === 'order' && action === 'CREATE') {
      const stockIssues = await this.checkStockAvailability(payload);
      if (stockIssues.length > 0) {
        return {
          hasConflict: true,
          type: 'stock_unavailable',
          details: { stockIssues },
        };
      }
    }

    // Check 3: Concurrent edits (version check)
    if (action === 'UPDATE') {
      const serverEntity = await this.getServerEntity(entityType, entityId);
      if (serverEntity) {
        const clientVersion = payload._version || payload.updatedAt;
        const serverVersion = serverEntity.updatedAt;

        if (clientVersion && new Date(clientVersion) < new Date(serverVersion)) {
          return {
            hasConflict: true,
            type: 'version_mismatch',
            details: {
              clientVersion,
              serverVersion,
              serverData: this.sanitizeEntity(serverEntity),
            },
          };
        }
      }
    }

    return { hasConflict: false };
  }

  async resolve(event: any, conflict: ConflictCheck): Promise<ResolutionResult> {
    switch (conflict.type) {
      case 'duplicate':
        return {
          strategy: 'server_wins',
          message: 'Duplicate event detected. Server version kept.',
        };

      case 'stock_unavailable':
        // For stock issues, flag for manual review if critical
        const critical = conflict.details.stockIssues.some((i: any) => i.requested > i.available * 2);
        if (critical) {
          return {
            strategy: 'manual_review',
            message: 'Critical stock shortage requires manual approval.',
          };
        }
        // Auto-reduce quantities to available stock
        return {
          strategy: 'merge',
          resolvedData: this.adjustQuantities(event.payload, conflict.details.stockIssues),
          message: 'Quantities adjusted to available stock.',
        };

      case 'version_mismatch':
        // Auto-merge for simple fields, manual for complex
        const merged = this.attemptMerge(event.payload, conflict.details.serverData);
        if (merged.canAutoMerge) {
          return {
            strategy: 'merge',
            resolvedData: merged.data,
            message: 'Changes auto-merged successfully.',
          };
        }
        return {
          strategy: 'manual_review',
          message: 'Conflicting changes require manual resolution.',
        };

      default:
        return {
          strategy: 'manual_review',
          message: 'Unknown conflict type requires review.',
        };
    }
  }

  private async checkStockAvailability(orderPayload: any): Promise<any[]> {
    const issues = [];
    for (const item of orderPayload.items || []) {
      const inventory = await this.prisma.inventory.findFirst({
        where: { productId: item.productId },
      });

      if (!inventory) {
        issues.push({ productId: item.productId, requested: item.quantity, available: 0 });
      } else {
        const available = Number(inventory.quantity) - Number(inventory.reserved);
        if (available < item.quantity) {
          issues.push({ productId: item.productId, requested: item.quantity, available });
        }
      }
    }
    return issues;
  }

  private async getServerEntity(entityType: string, entityId: string) {
    switch (entityType) {
      case 'customer':
        return this.prisma.customer.findUnique({ where: { id: entityId } });
      case 'order':
        return this.prisma.order.findUnique({ where: { id: entityId } });
      case 'product':
        return this.prisma.product.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  private sanitizeEntity(entity: any): any {
    const { password, ...rest } = entity;
    return rest;
  }

  private adjustQuantities(payload: any, stockIssues: any[]): any {
    const adjusted = { ...payload };
    adjusted.items = payload.items.map((item: any) => {
      const issue = stockIssues.find((i: any) => i.productId === item.productId);
      if (issue) {
        return { ...item, quantity: issue.available, note: 'Adjusted due to stock shortage' };
      }
      return item;
    });
    return adjusted;
  }

  private attemptMerge(clientData: any, serverData: any): { canAutoMerge: boolean; data?: any } {
    // Simple field-level merge: if fields don't overlap, merge them
    const clientFields = Object.keys(clientData).filter(k => k !== 'id' && k !== '_version');
    const serverFields = Object.keys(serverData).filter(k => k !== 'id' && k !== 'updatedAt');

    const overlapping = clientFields.filter(f => serverFields.includes(f) && JSON.stringify(clientData[f]) !== JSON.stringify(serverData[f]));

    if (overlapping.length === 0) {
      return { canAutoMerge: true, data: { ...serverData, ...clientData } };
    }

    // Check if overlaps are in different nested paths (safe to merge)
    const safeOverlap = overlapping.every(field => {
      const cVal = clientData[field];
      const sVal = serverData[field];
      return typeof cVal !== 'object' || typeof sVal !== 'object';
    });

    if (safeOverlap) {
      // For primitive overlaps, prefer client for their fields, server for others
      return { canAutoMerge: true, data: { ...serverData, ...clientData } };
    }

    return { canAutoMerge: false };
  }
}
