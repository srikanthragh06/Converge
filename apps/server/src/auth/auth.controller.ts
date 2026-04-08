import { Body, Controller, Post } from '@nestjs/common';
import { type GoogleAuthDto, GoogleAuthSchema } from '@converge/shared';
import { AuthService } from './auth.service';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';
import { httpOK } from '../utils/http-response.util';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/google')
  async handleGoogleAuth(
    @Body(new ZodHttpValidationPipe(GoogleAuthSchema)) { code }: GoogleAuthDto,
  ) {
    await this.authService.exchangeCodeWithGoogleAuth(code);
    return httpOK();
  }
}
