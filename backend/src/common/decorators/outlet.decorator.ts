import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Populated by OutletGuard. Only present on routes that use @UseGuards(OutletGuard).
export const CurrentOutlet = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.outlet;
});
