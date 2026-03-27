import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './utils/global-exception.filter';
import { registerProcessHandlers } from './utils/process.handlers';

// Register process-level error handlers before anything else starts.
// These are the last line of defense for errors that escape NestJS entirely.
registerProcessHandlers();

async function bootstrap() {
  // AppModule is the root module — all feature modules are imported from there.
  const app = await NestFactory.create(AppModule);

  // Global exception filter — catches all unhandled exceptions within NestJS's
  // pipeline (controllers, services, guards, etc.) and returns a proper HTTP response.
  app.useGlobalFilters(new GlobalExceptionFilter());

  const PORT = 5000;
  await app.listen(PORT);
}
bootstrap();
