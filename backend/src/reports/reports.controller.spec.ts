import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { ReportsController } from './reports.controller';

describe('ReportsController authorization', () => {
  it('requires reports.read for every report endpoint', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ReportsController)).toEqual([
      Permission.REPORTS_READ,
    ]);
  });
});
