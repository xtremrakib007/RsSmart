import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|api[-_]?key|client[-_]?secret|private[-_]?key|refresh|credential|cvv|cvc|card[-_]?number|pan)/i;
const MAX_AUDIT_DEPTH = 6;
const MAX_AUDIT_STRING_LENGTH = 2000;

// Audit payloads may contain snapshots of arbitrary application objects.
// Redact by key before persistence, and bound depth/string size to avoid
// accidentally storing credentials or oversized request bodies in audit JSON.
function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > MAX_AUDIT_STRING_LENGTH
      ? value.slice(0, MAX_AUDIT_STRING_LENGTH) + '[TRUNCATED]'
      : value;
  }
  if (depth >= MAX_AUDIT_DEPTH) return '[MAX_DEPTH]';
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeAuditValue(child, depth + 1);
    }
    return result;
  }
  return String(value).slice(0, MAX_AUDIT_STRING_LENGTH);
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ...data,
        oldValues: data.oldValues === undefined ? undefined : sanitizeAuditValue(data.oldValues) as any,
        newValues: data.newValues === undefined ? undefined : sanitizeAuditValue(data.newValues) as any,
        action: data.action.slice(0, 100),
        entityType: data.entityType.slice(0, 100),
        entityId: data.entityId.slice(0, 200),
        ipAddress: data.ipAddress?.slice(0, 100),
        userAgent: data.userAgent?.slice(0, 500),
      },
    });
  }

  async getLogs(tenantId: string, filters?: { entityType?: string; entityId?: string; fromDate?: string; toDate?: string }) {
    const where: any = { tenantId };
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        const fromDate = new Date(filters.fromDate);
        if (!Number.isNaN(fromDate.getTime())) where.createdAt.gte = fromDate;
      }
      if (filters.toDate) {
        const toDate = new Date(filters.toDate);
        if (!Number.isNaN(toDate.getTime())) where.createdAt.lte = toDate;
      }
    }
    return this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
