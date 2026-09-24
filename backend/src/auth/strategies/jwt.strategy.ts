import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WILDCARD_PERMISSION } from '../../common/permissions/permission.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: true } },
        outlets: { select: { outletId: true, isDefault: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Session revocation: a role change, permission change, or admin
    // disable bumps tokenVersion (see UsersService). Any JWT signed before
    // that bump stops being trusted immediately instead of staying valid
    // until its natural expiry — this was flagged as a Phase 12 gap
    // ("ensure role/permission changes cannot remain active longer than
    // intended").
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Session has been invalidated, please log in again');
    }

    const roleNames = user.roles.map((r) => r.role.name);
    const permissions = Array.from(
      new Set(user.roles.flatMap((r) => (Array.isArray(r.role.permissions) ? (r.role.permissions as string[]) : []))),
    );
    const scopeAllOutlets =
      user.roles.some((r) => r.role.scopeAllOutlets) || permissions.includes(WILDCARD_PERMISSION);

    return {
      userId: payload.sub,
      email: payload.email,
      // Read tenantId from the freshly-fetched user record, not the JWT payload —
      // a token issued before a user's tenant was reassigned would otherwise keep
      // asserting the old tenantId until it expires.
      tenantId: user.tenantId,
      // Roles/permissions are read fresh from the DB on every request (not
      // from the signed payload) so a role or permission change takes effect
      // immediately rather than only after the token expires.
      roles: roleNames,
      permissions,
      scopeAllOutlets,
      outletIds: user.outlets.map((o) => o.outletId),
      tokenVersion: user.tokenVersion,
    };
  }
}
