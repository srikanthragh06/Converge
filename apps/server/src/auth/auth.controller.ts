import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { httpOK } from '../utils/http-response.util';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/google')
  async handleGoogleAuth(@Body() body: { code: string }) {
    const { code } = body;

    if (!code) throw new BadRequestException('code is required');

    await this.authService.exchangeCodeWithGoogleAuth(code);
    return httpOK();
  }
}
