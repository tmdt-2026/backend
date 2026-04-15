import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      if (typeof exceptionResponse === 'object') {
        message = exceptionResponse.message ?? message;
        code = exceptionResponse.code ?? exceptionResponse.error ?? code;
      } else {
        message = exceptionResponse;
      }
    } else {
      this.logger.error('Unhandled exception', (exception as Error)?.stack);
    }

    response.status(status).json({
      success: false,
      error: { code, message, statusCode: status },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
