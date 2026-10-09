import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId || request.header('x-request-id') || 'unavailable';

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Do not serialize exception messages, stacks, SQL, tokens, or request
      // bodies into client responses or routine logs.
      this.logger.error(`Request failed with status ${status}; requestId=${requestId}`);
    }

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (isHttpException && status < HttpStatus.INTERNAL_SERVER_ERROR) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const payload = exceptionResponse as Record<string, unknown>;
        const candidateMessage = payload.message;
        if (
          typeof candidateMessage === 'string' ||
          (Array.isArray(candidateMessage) &&
            candidateMessage.every((item) => typeof item === 'string'))
        ) {
          message = candidateMessage as string | string[];
        }
        if (typeof payload.error === 'string') error = payload.error;
      } else {
        message = exception.message;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}
