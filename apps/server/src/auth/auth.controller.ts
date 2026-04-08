import { Body, Controller, Post, Res } from '@nestjs/common';
import {
  type GoogleAuthRequestDto,
  GoogleAuthRequestSchema,
} from '@converge/shared';
import { AuthService } from './auth.service';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';
import { httpOK } from '../utils/http-response.util';
import type { Response } from 'express';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // Handles Google OAuth token exchange and user persistence.

  /**
   * Accepts a Google OAuth authorisation code, exchanges it for user profile
   * data, upserts the user record, and sets a signed JWT as an httpOnly cookie.
   * Validation or upstream errors surface as 4xx/5xx responses.
   *
   * @param code - The short-lived authorisation code from Google's OAuth redirect.
   * @param res - The Express response object, used to set the auth cookie.
   */
  @Post('/google')
  async handleGoogleAuth(
    @Body(new ZodHttpValidationPipe(GoogleAuthRequestSchema))
    { code }: GoogleAuthRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authToken =
      await this.authService.authorizeGoogleUserAndGenerateJWT(code);
    // httpOnly prevents client-side JS from reading the token, mitigating XSS theft.
    res.cookie('authToken', authToken, {
      httpOnly: true,
      sameSite: 'strict',
      // maxAge is in milliseconds — must match the JWT's own expiry.
      maxAge: AuthService.AUTH_EXPIRY_TTL_SECONDS * 1000,
    });
    return httpOK();
  }
}
