import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as Request & { requestId?: string }).requestId = requestId;
    next();
  }
}
