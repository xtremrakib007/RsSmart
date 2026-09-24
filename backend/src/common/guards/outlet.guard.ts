import { Injectable, CanActivate, ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Resolves which outlet a request applies to and checks the current user is
// allowed to act on it, then attaches it to the request as `request.outlet`
// for @CurrentOutlet() to read.
//
// Resolution order: `x-outlet-id` header, then `outletId` route param, query
// param, or body field, then finally the user's default outlet (from
// UserOutlet.isDefault) if none was supplied.
//
// Access rule: users whose role(s) have scopeAllOutlets=true (owner/admin by
// default) may act on any outlet in their tenant. Everyone else must have an
// explicit UserOutlet assignment for the requested outlet.
@Injectable()
export class OutletGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    // No user means JwtAuthGuard hasn't populated the request (e.g. a public
    // route was also decorated with OutletGuard by mistake) — nothing for us
    // to check; let it through and let the rest of the pipeline decide.
    if (!user) return true;

    const requestedOutletId: string | undefined =
      request.headers['x-outlet-id'] ||
      request.params?.outletId ||
      request.query?.outletId ||
      request.body?.outletId;

    let outletId = requestedOutletId;
    if (!outletId) {
      const defaultAssignment = await this.prisma.userOutlet.findFirst({
        where: { userId: user.userId, isDefault: true },
      });
      outletId = defaultAssignment?.outletId;
    }

    if (!outletId) {
      throw new BadRequestException(
        'No outlet specified (send an x-outlet-id header or outletId) and this user has no default outlet assigned',
      );
    }

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId },
    });
    if (!outlet) {
      throw new ForbiddenException('Outlet not found for this company');
    }
    if (outlet.status !== 'ACTIVE') {
      throw new ForbiddenException('This outlet is inactive');
    }

    if (!user.scopeAllOutlets) {
      const access = await this.prisma.userOutlet.findUnique({
        where: { userId_outletId: { userId: user.userId, outletId } },
      });
      if (!access) {
        throw new ForbiddenException('You do not have access to this outlet');
      }
    }

    request.outlet = outlet;
    return true;
  }
}
