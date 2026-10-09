import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../common/decorators/user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@RequirePermissions(Permission.REPORTS_READ)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales report' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  @ApiQuery({ name: 'salesRepId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  salesReport(
    @CurrentUser() user: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('salesRepId') salesRepId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.reportsService.salesReport(user.tenantId, { fromDate, toDate, salesRepId, customerId });
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Inventory report' })
  inventoryReport(@CurrentUser() user: any) {
    return this.reportsService.inventoryReport(user.tenantId);
  }

  @Get('collections')
  @ApiOperation({ summary: 'Collection report' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  collectionReport(
    @CurrentUser() user: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.reportsService.collectionReport(user.tenantId, { fromDate, toDate });
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer performance report' })
  customerReport(@CurrentUser() user: any) {
    return this.reportsService.customerReport(user.tenantId);
  }
}
