import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlanLimitExceededException } from '../common/exceptions/plan-limit.exception';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';

@Injectable()
export class OutletsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private entitlements: EntitlementsService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.outlet.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async get(tenantId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({ where: { id: outletId, tenantId } });
    if (!outlet) throw new NotFoundException('Outlet not found');
    return outlet;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateOutletDto) {
    // Phase 23 — enforce outlet limit
    const check = await this.entitlements.checkOutletLimit(tenantId);
    if (!check.allowed) {
      throw new PlanLimitExceededException('outlet', check.current, check.limit);
    }

    const existing = await this.prisma.outlet.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Outlet code "${dto.code}" is already in use for this company`);

    const outlet = await this.prisma.outlet.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone || 'Asia/Kuala_Lumpur',
        currency: dto.currency || 'MYR',
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'CREATE',
      entityType: 'Outlet',
      entityId: outlet.id,
      newValues: { code: outlet.code, name: outlet.name },
    });

    return outlet;
  }

  async update(tenantId: string, actorUserId: string, outletId: string, dto: UpdateOutletDto) {
    const outlet = await this.get(tenantId, outletId);

    if (dto.status === 'INACTIVE' && outlet.isDefault) {
      throw new BadRequestException('The default outlet cannot be deactivated');
    }

    const result = await this.prisma.outlet.updateMany({
      where: { id: outletId, tenantId },
      data: {
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone,
        currency: dto.currency,
        status: dto.status,
      },
    });
    if (result.count !== 1) throw new NotFoundException('Outlet not found');
    const updated = await this.get(tenantId, outletId);

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'Outlet',
      entityId: outlet.id,
      oldValues: outlet,
      newValues: updated,
    });

    return updated;
  }

  async listUsers(tenantId: string, outletId: string) {
    await this.get(tenantId, outletId);
    return this.prisma.userOutlet.findMany({
      where: { tenantId, outletId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
    });
  }

  async assignUser(tenantId: string, actorUserId: string, outletId: string, targetUserId: string, isDefault = false) {
    await this.get(tenantId, outletId);

    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, tenantId } });
    if (!user) throw new NotFoundException('User not found in this company');

    if (isDefault) {
      await this.prisma.userOutlet.updateMany({
        where: { tenantId, userId: targetUserId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const assignment = await this.prisma.userOutlet.upsert({
      where: { userId_outletId: { userId: targetUserId, outletId } },
      update: { isDefault },
      create: { tenantId, userId: targetUserId, outletId, isDefault },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'UserOutlet',
      entityId: assignment.id,
      newValues: { userId: targetUserId, outletId, isDefault },
    });

    return assignment;
  }

  async unassignUser(tenantId: string, actorUserId: string, outletId: string, targetUserId: string) {
    await this.get(tenantId, outletId);
    const assignment = await this.prisma.userOutlet.findUnique({
      where: { userId_outletId: { userId: targetUserId, outletId } },
    });
    if (!assignment || assignment.tenantId !== tenantId) {
      throw new NotFoundException('Assignment not found');
    }

    const remainingAssignments = await this.prisma.userOutlet.count({ where: { tenantId, userId: targetUserId } });
    if (remainingAssignments <= 1) {
      throw new BadRequestException("Cannot remove a user's last remaining outlet assignment");
    }

    await this.prisma.userOutlet.delete({ where: { id: assignment.id } });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'DELETE',
      entityType: 'UserOutlet',
      entityId: assignment.id,
      oldValues: { userId: targetUserId, outletId },
    });

    return { success: true };
  }
}
