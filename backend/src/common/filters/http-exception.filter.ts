import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      success: false,
      statusCode: status,
      message: exceptionResponse.message || exception.message,
      error: exceptionResponse.error || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }
}
