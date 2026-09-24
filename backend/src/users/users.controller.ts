import { Controller, Get, Post, Put, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all users in tenant' })
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.findOne(id, user.tenantId);
  }

  @Post('invite')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({
    summary: 'Invite a new employee into your company',
    description:
      'Creates a user in the CALLER\'s own company (tenantId is taken from the ' +
      'session, never the request body). roleIds and outletIds are validated ' +
      'to belong to that same company.',
  })
  invite(@CurrentUser() user: any, @Body() dto: InviteUserDto) {
    return this.authService.inviteUser(user.tenantId, dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: "Update a user's profile fields" })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(id, user.tenantId, dto);
  }

  @Patch(':id/roles')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: "Replace a user's role assignments" })
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto, @CurrentUser() user: any) {
    return this.usersService.assignRoles(id, user.tenantId, user.userId, dto.roleIds);
  }

  @Patch(':id/disable')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Disable a user account and immediately revoke its active sessions' })
  disable(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.disable(id, user.tenantId, user.userId);
  }

  @Patch(':id/enable')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Re-enable a previously disabled user account' })
  enable(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.enable(id, user.tenantId, user.userId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Deactivate user (alias of disable, kept for backwards compatibility)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user.tenantId, user.userId);
  }

  @Get('roles/list')
  @ApiOperation({ summary: 'Get all roles' })
  getRoles(@CurrentUser() user: any) {
    return this.usersService.getRoles(user.tenantId);
  }
}
