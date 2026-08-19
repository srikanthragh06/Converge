import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

// Wires up the database connection pool and exports DatabaseService so that
// feature modules can inject it without importing DatabaseModule themselves.
@Module({
  imports: [],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
