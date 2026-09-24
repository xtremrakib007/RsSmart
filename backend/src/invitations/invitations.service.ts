import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlanLimitExceededException } from '../common/exceptions/plan-limit.exception';
import { AuthService } from '../auth/auth.service';

// Mirrors the `InvitationStatus` enum in schema.prisma. Kept as a local
// string-literal type rather than imported from '@prisma/client' — same
// sandbox-typing workaround already used in subscriptions.service.ts /
// entitlements.service.ts, because `prisma generate` can't reach
// binaries.prisma.sh from this build sandbox (see PHASE14 notes). Swap for
// `import { InvitationStatus } from '@prisma/client'` once generate has
// actually run against this schema.
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

const INVITATION_EXPIRY_DAYS = 7;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Token-based "invite an employee → they accept and choose their own
 * password → login" flow (Phase 19). This is the primary way to add staff
 * to an existing company going forward.
 *
 * Relationship to AuthService.inviteUser (Phase 12): that method still
 * exists and still works — some integrations may depend on its
 * synchronous, no-accept-step shape — but it has the inviter choose the
 * new employee's password up front, which is a real credential-hygiene
 * problem (the inviter now knows, and typed, the employee's password) and
 * doesn't match "Owner → invite → accept → login" from the roadmap. New
 * call sites should prefer this service; inviteUser is kept only for
 * backwards compatibility and isn't wired into any new UI.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private auth: AuthService,
    private entitlements: EntitlementsService,
  ) {}

  /**
   * Creates a pending invitation in the CALLER's own tenant. roleIds and
   * outletIds are validated to actually belong to that tenant before use —
   * the same IDOR-closing check as AuthService.inviteUser. Returns the raw
   * token exactly once; only its sha256 hash is ever stored, so this
   * response (or whatever delivers it — email/WhatsApp integration is out
   * of scope for this phase) is the only place it's recoverable.
   */
  async create(
    inviterTenantId: string,
    inviterUserId: string,
    data: { email: string; firstName: string; lastName: string; roleIds: string[]; outletIds?: string[] },
  ) {
    if (!data.roleIds?.length) {
      throw new BadRequestException('At least one roleId is required');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: inviterTenantId, email: data.email } },
    });
    if (existingUser) throw new ConflictException('Email already registered in this company');

    const existingPending = await this.prisma.invitation.findFirst({
      where: { tenantId: inviterTenantId, email: data.email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('An invitation is already pending for this email — revoke it first to send a new one');
    }

    const roles = await this.prisma.role.findMany({
      where: { tenantId: inviterTenantId, id: { in: data.roleIds } },
    });
    if (roles.length !== data.roleIds.length) {
      throw new BadRequestException('One or more roleIds are invalid for this company');
    }

    let outletIds: string[] = [];
    if (data.outletIds?.length) {
      const outlets = await this.prisma.outlet.findMany({
        where: { tenantId: inviterTenantId, id: { in: data.outletIds } },
        select: { id: true },
      });
      if (outlets.length !== data.outletIds.length) {
        throw new BadRequestException('One or more outletIds are invalid for this company');
      }
      outletIds = outlets.map((o) => o.id);
    } else {
      const defaultOutlet = await this.prisma.outlet.findFirst({
        where: { tenantId: inviterTenantId, isDefault: true },
        select: { id: true },
      });
      if (defaultOutlet) outletIds = [defaultOutlet.id];
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: inviterTenantId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roleIds: data.roleIds,
        outletIds,
        tokenHash: hashToken(rawToken),
        invitedByUserId: inviterUserId,
        expiresAt,
      },
    });

    await this.audit.log({
      tenantId: inviterTenantId,
      userId: inviterUserId,
      action: 'CREATE',
      entityType: 'Invitation',
      entityId: invitation.id,
      newValues: { email: data.email, roleIds: data.roleIds, outletIds },
    });

    // token is returned ONLY here — it is not persisted anywhere and
    // cannot be recovered later, matching how findByToken/preview/accept
    // below only ever have the hash to compare against.
    return { invitation: this.toSafeInvitation(invitation), token: rawToken };
  }

  /** All invitations for the caller's tenant, most recent first. Never exposes tokenHash. */
  async list(tenantId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map((i) => this.toSafeInvitation(i));
  }

  /**
   * Revokes a still-pending invitation. Idempotent-ish on purpose: revoking
   * an already-revoked/expired/accepted invitation is a NotFound/BadRequest
   * rather than silently succeeding, so an admin gets clear feedback rather
   * than a false sense that a since-accepted invite was pulled in time.
   */
  async revoke(tenantId: string, invitationId: string, actorUserId: string) {
    const invitation = await this.prisma.invitation.findFirst({ where: { id: invitationId, tenantId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Cannot revoke an invitation with status ${invitation.status}`);
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'UPDATE',
      entityType: 'Invitation',
      entityId: invitationId,
      oldValues: { status: 'PENDING' },
      newValues: { status: 'REVOKED' },
    });

    return this.toSafeInvitation(updated);
  }

  /**
   * Unauthenticated preview so an accept-invitation page can show "You've
   * been invited to join {company} as {email}" before the invitee has typed
   * a password — read-only, does not consume or mutate the invitation.
   */
  async preview(rawToken: string) {
    const invitation = await this.findPendingByToken(rawToken);
    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      tenantName: invitation.tenant.name,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Consumes a pending invitation: creates the User in the invitation's
   * tenant with the roles/outlets captured at invite time, marks the
   * invitation ACCEPTED, and logs the invitee straight in — mirrors
   * AuthService.registerCompany's "create then return login tokens" shape.
   * Wrapped in a transaction so a half-created user can never exist next to
   * a still-PENDING invitation for the same token.
   */
  async accept(rawToken: string, password: string) {
    const invitation = await this.findPendingByToken(rawToken);

    // Phase 23 — enforce user limit before creating the invited user
    const check = await this.entitlements.checkUserLimit(invitation.tenantId);
    if (!check.allowed) {
      throw new PlanLimitExceededException('user', check.current, check.limit);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const roleIds = invitation.roleIds as string[];
    const outletIds = invitation.outletIds as string[];

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          password: hashedPassword,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          roles: { create: roleIds.map((roleId) => ({ roleId, tenantId: invitation.tenantId })) },
          outlets: {
            create: outletIds.map((outletId, i) => ({
              tenantId: invitation.tenantId,
              outletId,
              isDefault: i === 0,
            })),
          },
        },
        include: { roles: { include: { role: true } } },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedUserId: created.id },
      });

      return created;
    });

    await this.audit.log({
      tenantId: invitation.tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, viaInvitation: invitation.id },
    });

    const { password: _pw, ...safeUser } = user;
    return this.auth.login(safeUser);
  }

  /**
   * Shared lookup for preview() and accept(): hashes the raw token, finds
   * the matching row, and rejects anything that isn't currently PENDING —
   * including lazily flipping a stale-but-still-marked-PENDING row to
   * EXPIRED the moment it's looked up past its expiry, so an expired
   * invitation never silently succeeds just because a sweep job hasn't run.
   */
  private async findPendingByToken(rawToken: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { tenant: { select: { name: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found or already used');

    if (invitation.status === 'PENDING' && invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('This invitation has expired — ask your company admin to send a new one');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`This invitation is no longer valid (status: ${invitation.status})`);
    }

    return invitation;
  }

  private toSafeInvitation(invitation: any) {
    const { tokenHash: _hash, ...safe } = invitation;
    return safe;
  }
}
