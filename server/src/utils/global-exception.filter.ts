import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

// @Catch() with no arguments catches every exception — not just HttpExceptions.
// This is the global safety net for anything that bubbles up through NestJS's pipeline.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.error('Unhandled exception caught by filter:', exception);

    // The same filter is reused for HTTP, WebSocket, and job contexts.
    // Only send an HTTP response if we're actually in an HTTP request cycle.
    if (host.getType() === 'http') {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();

      // Preserve the status code for known NestJS HTTP exceptions (e.g. NotFoundException → 404).
      // Fall back to 500 for anything unexpected.
      const status =
        exception instanceof HttpException ? exception.getStatus() : 500;
      const message =
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error';

      response.status(status).json({ message });
    }
  }
}
