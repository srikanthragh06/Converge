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
  constructor(private readonly authService: AuthService) {} // Handles Google OAuth token exchange and user persistence.

  /**
   * Accepts a Google OAuth authorisation code, exchanges it for user profile
   * data, and upserts the user record. Returns a standard OK envelope on
   * success; validation or upstream errors surface as 4xx/5xx responses.
   *
   * @param code - The short-lived authorisation code from Google's OAuth redirect.
   */
  @Post('/google')
  async handleGoogleAuth(
    @Body(new ZodHttpValidationPipe(GoogleAuthRequestSchema))
    { code }: GoogleAuthRequestDto,
  ) {
    await this.authService.addUserFromGoogleAuth(code);
    return httpOK();
  }
}
