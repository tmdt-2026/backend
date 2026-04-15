import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Lỗi hệ thống';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      if (typeof exceptionResponse === 'object' && exceptionResponse.code) {
        code = exceptionResponse.code;
        message = exceptionResponse.message ?? message;
      } else {
        message = typeof exceptionResponse === 'string' ? exceptionResponse : exception.message;
        code = exception.constructor.name.replace('Exception', '').toUpperCase();
      }
    }

    response.status(status).json({
      success: false,
      error: { code, message, statusCode: status },
    });
  }
}
