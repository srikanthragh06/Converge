import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import * as jwt from 'jsonwebtoken';
import { DatabaseService } from '../db/database.service';
import { type GoogleAuthResponseDto } from '@converge/shared';
import type { Request, Response } from 'express';

@Injectable()
export class AuthService {
  static readonly AUTH_EXPIRY_TTL_SECONDS = 60 * 60 * 24 * 7; // Lifetime of the auth JWT and its cookie, in seconds (7 days).

  constructor(
    private readonly httpService: HttpService, // Used to POST the authorisation code to Google's token endpoint.
    private readonly configService: ConfigService, // Supplies OAuth credentials and redirect URI from environment config.
    private readonly dbService: DatabaseService, // Persists and upserts authenticated user records.
  ) {}

  /**
   * Exchanges a Google authorization code for an ID token, decodes it, and
   * upserts the user in the database — creating a new record on first login
   * or updating profile fields if the user already exists.
   *
   * @param code - The one-time authorisation code from Google's OAuth redirect.
   * @returns The signed JWT and the user's profile details.
   */
  async authorizeGoogleUserAndGenerateJWT(
    code: string,
  ): Promise<{ authToken: string; userDetails: GoogleAuthResponseDto }> {
    // Exchange the one-time code for Google token data; map axios errors to
    // appropriate HTTP exceptions before they reach the NestJS pipeline.
    let data: any;
    try {
      data = await this.exchangeCodeWithGoogleAuth(code);
    } catch (err) {
      const error = err as Record<string, unknown>;
      if (error?.response) {
        // Google responded but rejected the code — treat as a bad client request.
        throw new BadRequestException('Invalid or expired authorisation code.');
      }
      // No response at all — network failure or Google is unreachable.
      throw new InternalServerErrorException('Failed to reach Google.');
    }

    // Verify that Google included an ID token in the response.
    const { id_token: idToken } = data;
    if (!idToken) {
      throw new InternalServerErrorException(
        'Google did not return an ID token.',
      );
    }

    // Decode the JWT and assert that all required profile claims are present.
    // jwt.decode does not verify the signature; we trust Google's HTTPS endpoint
    // for authenticity and only need the payload contents here.
    const decoded = jwt.decode(idToken);
    const isValid =
      typeof decoded === 'object' &&
      decoded !== null &&
      'sub' in decoded &&
      'email' in decoded &&
      'name' in decoded &&
      'picture' in decoded;

    if (!isValid) {
      throw new InternalServerErrorException(
        'Failed to decode Google ID token.',
      );
    }

    const { sub, email, name, picture } = decoded as {
      sub: string;
      email: string;
      name: string;
      picture: string;
    };

    // Upsert the user record, keying on google_id so that email changes on the
    // Google account side are reflected without creating duplicate rows.
    const rows = await this.dbService.kysely
      .insertInto('users')
      .values({ google_id: sub, email, name, avatar_url: picture })
      .onConflict((oc) =>
        // On subsequent logins, keep profile fields in sync with Google.
        oc
          .column('google_id')
          .doUpdateSet({ email, name, avatar_url: picture }),
      )
      .returning(['id', 'email', 'avatar_url', 'created_at', 'name'])
      .execute();

    if (rows.length === 0)
      throw new InternalServerErrorException('Failed to upsert user.');

    const authToken = this.prepareUserJWT(rows[0].id, rows[0].email);

    const userDetails: GoogleAuthResponseDto = {
      id: rows[0].id.toString(), // convert to string for consistent serialisation across all API consumers.
      email: rows[0].email,
      name: rows[0].name,
      avatarUrl: rows[0].avatar_url,
      createdAt: rows[0].created_at,
    };

    return { authToken, userDetails };
  }

  /**
   * POSTs the authorisation code to Google's token endpoint and returns the
   * raw token response data. Throws an axios error on any non-2xx response or
   * network failure — callers are responsible for error mapping.
   *
   * @param code - The one-time authorisation code received from Google's OAuth redirect.
   * @returns The raw response body from Google's token endpoint, including `id_token`.
   */
  async exchangeCodeWithGoogleAuth(code: string): Promise<any> {
    const { data } = await firstValueFrom(
      this.httpService.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        redirect_uri: this.configService.get<string>(
          'GOOGLE_AUTH_CLIENT_CALLBACK_URL',
        ),
      }),
    );

    return data;
  }

  /**
   * Verifies the auth JWT from the request cookie, checks the user exists in
   * the database, and stamps the numeric user ID onto the request object so
   * downstream handlers can read it without re-querying.
   * Throws UnauthorizedException on any validation failure so NestJS returns 401.
   *
   * @param req - The Express request object carrying the authToken cookie.
   */
  async verifyReqAuthAndAttachUserToReq(req: Request): Promise<void> {
    const authToken = req.cookies.authToken as string;
    if (!authToken)
      throw new UnauthorizedException(
        'No authToken present in request cookies',
      );

    const secret = this.configService.get<string>('JWT_SECRET');
    const payload = jwt.verify(authToken, secret!);

    if (typeof payload === 'string') {
      throw new UnauthorizedException('Invalid token payload.');
    }

    const { userId, userEmail } = payload;

    // Ensure both claims are non-empty strings before any further checks.
    if (typeof userId !== 'string' || !userId) {
      throw new UnauthorizedException('Invalid userId in auth token.');
    }
    if (typeof userEmail !== 'string' || !userEmail) {
      throw new UnauthorizedException('Invalid userEmail in auth token.');
    }

    // userId was serialised as a string when signing — ensure it parses to a valid number.
    const numericUserId = Number(userId);
    if (isNaN(numericUserId)) {
      throw new UnauthorizedException('userId in auth token is not a valid number.');
    }

    const db = this.dbService.kysely;
    const user = await db
      .selectFrom('users')
      .select('users.id')
      .where('users.id', '=', numericUserId)
      .where('users.email', '=', userEmail)
      .executeTakeFirst();

    if (!user) {
      throw new UnauthorizedException(
        'User not found — token may belong to a deleted account.',
      );
    }
    (req as any).userId = user.id;
  }

  /**
   * Signs and returns a JWT containing the user's ID and email, using the
   * secret from environment config.
   *
   * @param userId - The internal database ID of the authenticated user, serialised to string in the payload.
   * @param userEmail - The email address of the authenticated user.
   * @returns A signed JWT string to be sent to the client.
   */
  prepareUserJWT(userId: number, userEmail: string): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    // Serialize userId as a string so the payload type is consistent across all JWT consumers.
    return jwt.sign({ userId: userId.toString(), userEmail }, secret!, {
      expiresIn: AuthService.AUTH_EXPIRY_TTL_SECONDS,
    });
  }

  /**
   * Sets the auth JWT as an httpOnly cookie on the response.
   *
   * @param res - The Express response object to attach the cookie to.
   * @param token - The signed JWT to store in the cookie.
   */
  setAuthCookie(res: Response, token: string): void {
    // httpOnly prevents client-side JS from reading the token, mitigating XSS theft.
    res.cookie('authToken', token, {
      httpOnly: true,
      sameSite: 'strict',
      // maxAge is in milliseconds — must match the JWT's own expiry.
      maxAge: AuthService.AUTH_EXPIRY_TTL_SECONDS * 1000,
    });
  }

  /**
   * Clears the auth cookie from the response, effectively logging the user out.
   *
   * @param res - The Express response object to clear the cookie on.
   */
  clearAuthCookie(res: Response): void {
    res.clearCookie('authToken');
  }
}
