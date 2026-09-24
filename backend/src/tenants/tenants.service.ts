import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

export interface TenantBranding {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getBranding(tenantId: string): Promise<TenantBranding> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settings = (tenant.settings as Record<string, any>) || {};
    const branding = settings.branding || {};

    return {
      // Falls back to the tenant's registered company name until a company
      // explicitly sets a different in-app display name.
      displayName: branding.displayName || tenant.name,
      logoUrl: branding.logoUrl || null,
      primaryColor: branding.primaryColor || null,
    };
  }

  async updateBranding(tenantId: string, dto: UpdateBrandingDto): Promise<TenantBranding> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settings = (tenant.settings as Record<string, any>) || {};
    const branding = { ...(settings.branding || {}), ...dto };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, branding } },
    });

    return this.getBranding(tenantId);
  }
}
