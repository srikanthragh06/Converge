import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { wsInternalServerError } from './ws-response.util';
import { httpInternalServerError } from './http-response.util';

// @Catch() with no arguments catches every exception — not just HttpExceptions.
// This is the global safety net for anything that bubbles up through NestJS's pipeline.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.error('Unhandled exception caught by filter:', exception);

    // Handle each transport context separately — the response mechanism differs per type.
    if (host.getType() === 'http') {
      const response = host.switchToHttp().getResponse();

      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(httpInternalServerError());
    } else if (host.getType() === 'ws') {
      const client = host.switchToWs().getClient<Socket>();
      client.emit('error', wsInternalServerError());
    }
  }
}
