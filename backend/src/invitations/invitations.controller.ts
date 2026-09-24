import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Post()
  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Invite a new employee into your company',
    description:
      "Creates a pending invitation in the CALLER's own company (tenantId is taken " +
      'from the session, never the request body). Returns a one-time token — the ' +
      'invitee uses it with POST /invitations/accept to set their own password and ' +
      'join. roleIds and outletIds are validated to belong to that same company.',
  })
  create(@CurrentUser() user: any, @Body() dto: CreateInvitationDto) {
    return this.invitationsService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: "List your company's invitations (pending, accepted, revoked, expired)" })
  list(@CurrentUser() user: any) {
    return this.invitationsService.list(user.tenantId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Revoke a pending invitation before it is accepted' })
  revoke(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invitationsService.revoke(user.tenantId, id, user.userId);
  }

  @Public()
  @Get('preview/:token')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Preview a pending invitation (company/email) before accepting — read-only' })
  preview(@Param('token') token: string) {
    return this.invitationsService.preview(token);
  }

  @Public()
  @Post('accept')
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // matches the login/register throttle
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation, set your own password, and receive login tokens' })
  accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(dto.token, dto.password);
  }
}
