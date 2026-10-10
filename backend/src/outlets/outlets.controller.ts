import { Controller, Get, Post, Patch, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OutletsService } from './outlets.service';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';
import { AssignUserOutletDto } from './dto/assign-user-outlet.dto';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('Outlets')
@ApiBearerAuth()
@Controller('outlets')
export class OutletsController {
  constructor(private readonly outlets: OutletsService) {}

  @Get()
  @RequirePermissions(Permission.OUTLETS_READ)
  @ApiOperation({ summary: "List the current company's outlets" })
  list(@CurrentUser() user: any) {
    return this.outlets.list(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.OUTLETS_READ)
  @ApiOperation({ summary: 'Get a single outlet' })
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.outlets.get(user.tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.OUTLETS_MANAGE)
  @ApiOperation({ summary: 'Create a new outlet for the current company' })
  create(@CurrentUser() user: any, @Body() dto: CreateOutletDto) {
    return this.outlets.create(user.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OUTLETS_MANAGE)
  @ApiOperation({ summary: 'Update an outlet (rename, edit address, activate/deactivate)' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateOutletDto) {
    return this.outlets.update(user.tenantId, user.userId, id, dto);
  }

  @Get(':id/users')
  @RequirePermissions(Permission.OUTLETS_MANAGE)
  @ApiOperation({ summary: 'List users assigned to this outlet' })
  listUsers(@CurrentUser() user: any, @Param('id') id: string) {
    return this.outlets.listUsers(user.tenantId, id);
  }

  @Post(':id/users')
  @RequirePermissions(Permission.OUTLETS_MANAGE)
  @ApiOperation({ summary: 'Assign an existing company user to this outlet' })
  assignUser(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignUserOutletDto) {
    return this.outlets.assignUser(user.tenantId, user.userId, id, dto.userId, dto.isDefault);
  }

  @Delete(':id/users/:userId')
  @RequirePermissions(Permission.OUTLETS_MANAGE)
  @ApiOperation({ summary: 'Remove a user from this outlet' })
  unassignUser(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.outlets.unassignUser(user.tenantId, user.userId, id, userId);
  }
}
