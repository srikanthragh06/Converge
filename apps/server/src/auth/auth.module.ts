import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../db/database.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [HttpModule, DatabaseModule],
})
export class AuthModule {}
