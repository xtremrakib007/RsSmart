import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userTenantId = request.user?.tenantId;
    const paramTenantId = request.params?.tenantId || request.query?.tenantId || request.body?.tenantId;

    if (paramTenantId && paramTenantId !== userTenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    request.tenant = { id: userTenantId };
    return true;
  }
}
