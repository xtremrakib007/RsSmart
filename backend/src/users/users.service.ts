import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      include: { roles: { include: { role: true } }, outlets: { include: { outlet: true } } },
      omit: { password: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { roles: { include: { role: true } }, outlets: { include: { outlet: true } } },
      omit: { password: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, tenantId: string, data: { firstName?: string; lastName?: string }) {
    await this.findOne(id, tenantId);
    return this.prisma.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: true } } },
      omit: { password: true },
    });
  }

  /**
   * Deactivates the account AND bumps tokenVersion so any JWT already
   * issued to this user is rejected on its very next request instead of
   * remaining valid until it naturally expires (Phase 12: "account
   * disable/revoke").
   */
  async disable(id: string, tenantId: string, actorUserId: string) {
    const target = await this.findOne(id, tenantId);
    if (target.id === actorUserId) {
      throw new BadRequestException('You cannot disable your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE', tokenVersion: { increment: 1 } },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValues: { status: target.status },
      newValues: { status: 'INACTIVE' },
    });

    return { id: updated.id, status: updated.status };
  }

  async enable(id: string, tenantId: string, actorUserId: string) {
    const target = await this.findOne(id, tenantId);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValues: { status: target.status },
      newValues: { status: 'ACTIVE' },
    });

    return { id: updated.id, status: updated.status };
  }

  /** Kept for backwards compatibility with the old DELETE /users/:id route. */
  async remove(id: string, tenantId: string, actorUserId: string) {
    return this.disable(id, tenantId, actorUserId);
  }

  /**
   * Replaces a user's role assignments. roleIds are validated to belong to
   * the caller's own tenant before use. Bumps tokenVersion so the
   * permission change takes effect immediately (see JwtStrategy).
   */
  async assignRoles(id: string, tenantId: string, actorUserId: string, roleIds: string[]) {
    const target = await this.findOne(id, tenantId);

    const roles = await this.prisma.role.findMany({ where: { tenantId, id: { in: roleIds } } });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid for this company');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId, tenantId })) }),
      this.prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } }),
    ]);

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValues: { roles: target.roles.map((r: any) => r.role.name) },
      newValues: { roles: roles.map((r) => r.name) },
    });

    return this.findOne(id, tenantId);
  }

  async getRoles(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId } });
  }
}
