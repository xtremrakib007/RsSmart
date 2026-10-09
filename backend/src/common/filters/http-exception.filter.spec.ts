import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  function createHost() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const request = {
      requestId: 'test-request-123',
      header: jest.fn().mockReturnValue(undefined),
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, response };
  }

  it('returns a generic message for unexpected exceptions without leaking details', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new Error('database password is secret'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        requestId: 'test-request-123',
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('database password');
  });

  it('preserves safe client error messages', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new BadRequestException('Invalid input'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid input',
        requestId: 'test-request-123',
      }),
    );
  });
});
