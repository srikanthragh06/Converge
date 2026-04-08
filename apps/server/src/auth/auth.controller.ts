import { Body, Controller, Post } from '@nestjs/common';
import {
  type GoogleAuthRequestDto,
  GoogleAuthRequestSchema,
} from '@converge/shared';
import { AuthService } from './auth.service';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';
import { httpOK } from '../utils/http-response.util';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/google')
  async handleGoogleAuth(
    @Body(new ZodHttpValidationPipe(GoogleAuthRequestSchema))
    { code }: GoogleAuthRequestDto,
  ) {
    await this.authService.exchangeCodeWithGoogleAuth(code);
    return httpOK();
  }
}
