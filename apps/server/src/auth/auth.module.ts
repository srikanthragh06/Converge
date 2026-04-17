import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../db/database.module';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  imports: [HttpModule, DatabaseModule],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
