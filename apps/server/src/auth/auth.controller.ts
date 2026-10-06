import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  type GoogleAuthRequestDto,
  GoogleAuthRequestSchema,
  type AuthResponseDto,
} from '@converge/shared';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { GoogleAuthRateLimitGuard } from './google-auth-rate-limit.guard.js';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe.js';
import { httpOK } from '../utils/http-response.util.js';
import type { Request, Response } from 'express';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // Handles Google OAuth token exchange and user persistence.

  /**
   * Returns the authenticated user's profile. Requires a valid authToken cookie.
   * Used by the frontend on app load to hydrate auth state.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @returns The authenticated user's profile.
   */
  @Get('/me')
  @UseGuards(AuthGuard)
  async handleGetMe(@Req() req: Request): Promise<AuthResponseDto> {
    const userId = (req as any).userId as number;
    const userDetails = await this.authService.getMe(userId);
    return httpOK(userDetails);
  }

  /**
   * Clears the httpOnly auth cookie, ending the user's session. No auth guard
   * is applied so that users with expired or invalid tokens can still log out
   * cleanly without getting a 401.
   *
   * @param res - The Express response object, used to clear the auth cookie.
   */
  @Post('/logout')
  @HttpCode(200)
  handleLogout(@Res({ passthrough: true }) res: Response): void {
    this.authService.clearAuthCookie(res);
  }

  /**
   * Accepts a Google OAuth authorisation code, exchanges it for user profile
   * data, upserts the user record, and sets a signed JWT as an httpOnly cookie.
   * Validation or upstream errors surface as 4xx/5xx responses.
   *
   * @param code - The short-lived authorisation code from Google's OAuth redirect.
   * @param redirectUri - The redirect_uri the client used to obtain `code`; must be echoed
   * back to Google verbatim during the token exchange.
   * @param res - The Express response object, used to set the auth cookie.
   */
  @Post('/google')
  @UseGuards(GoogleAuthRateLimitGuard)
  async handleGoogleAuth(
    @Body(new ZodHttpValidationPipe(GoogleAuthRequestSchema))
    { code, redirectUri }: GoogleAuthRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    try {
      const { authToken, userDetails } =
        await this.authService.authorizeGoogleUserAndGenerateJWT(
          code,
          redirectUri,
        );
      this.authService.setAuthCookie(res, authToken);
      return httpOK(userDetails);
    } catch (err) {
      // Clear any stale auth cookie from a previous session so the client
      // doesn't remain partially authenticated after a failed re-auth attempt.
      this.authService.clearAuthCookie(res);
      throw err;
    }
  }
}
