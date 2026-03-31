import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './utils/global-exception.filter';
import { registerProcessHandlers } from './utils/process.handlers';
import { loadEnv } from './utils/env.loader';
import { IoAdapter } from '@nestjs/platform-socket.io';

loadEnv();

// Register process-level error handlers before anything else starts.
// These are the last line of defense for errors that escape NestJS entirely.
registerProcessHandlers();

/**
 * Bootstraps the NestJS application: creates the app, wires up adapters and
 * global filters, validates required env vars, then starts listening.
 */
async function bootstrap() {
  // AppModule is the root module — all feature modules are imported from there.
  const app = await NestFactory.create(AppModule);

  // Attach Socket.io to the same HTTP server so WebSocket and REST share one port.
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global exception filter — catches all unhandled exceptions within NestJS's
  // pipeline (controllers, services, guards, etc.) and returns a proper HTTP response.
  app.useGlobalFilters(new GlobalExceptionFilter());

  // validate PORT early so the error is clear rather than a cryptic bind failure
  const PORT = process.env.PORT;
  if (PORT === undefined) {
    throw new Error('PORT is not defined. Check your .env file.');
  }

  await app.listen(PORT);
}
bootstrap();
