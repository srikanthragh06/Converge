import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async exchangeCodeWithGoogleAuth(code: string): Promise<void> {
    try {
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

      if (!data.id_token) {
        throw new InternalServerErrorException(
          'Google did not return an ID token.',
        );
      }
    } catch (err) {
      // Re-throw NestJS exceptions — they already carry the correct status code.
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }

      const error = err as Record<string, unknown>;
      if (error?.response) {
        // Google responded but rejected the code — treat as a bad client request.
        throw new BadRequestException('Invalid or expired authorisation code.');
      }
      // No response at all — network failure or Google is unreachable.
      throw new InternalServerErrorException('Failed to reach Google.');
    }
  }
}
