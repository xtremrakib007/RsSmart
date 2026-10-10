import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { listPublishedPolicies } from './policy-registry';
import { LegalPoliciesService } from './policies.service';

@ApiTags('Legal policies')
@Controller('legal-policies')
export class LegalPoliciesController {
  constructor(private readonly policies: LegalPoliciesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List current policies and versions required for company registration' })
  listPolicies() {
    return listPublishedPolicies();
  }

  @Get('acceptances')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the authenticated company's policy acceptance evidence" })
  listAcceptances(@CurrentUser() user: any) {
    return this.policies.listAcceptances(user.tenantId);
  }

  @Get('acceptances/export.pdf')
  @UseGuards(AuthGuard('jwt'))
  @Roles('owner', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export the authenticated company policy acceptance register as PDF (owner/admin only)' })
  async exportPdf(@CurrentUser() user: any, @Res() response: Response) {
    const bytes = await this.policies.createPdf(user.tenantId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="company-policy-acceptance-register.pdf"');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(bytes);
  }
}
