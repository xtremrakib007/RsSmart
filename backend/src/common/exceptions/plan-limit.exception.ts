import { HttpException, HttpStatus } from '@nestjs/common';

export class PlanLimitExceededException extends HttpException {
  constructor(
    public readonly resource: string,
    public readonly current: number,
    public readonly limit: number,
  ) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Plan Limit Exceeded',
        message: `Your plan allows ${limit} ${resource}(s). You currently have ${current}. Upgrade your plan to add more.`,
        resource,
        current,
        limit,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
