import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Resolves a Bearer API key from the request's Authorization header to a
   * userId and stamps it onto the request, mirroring how AuthGuard stamps
   * userId from a session cookie. Used for non-browser callers (MCP, CLI)
   * that can't obtain a session cookie.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const header = request.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }
    const rawKey = header.slice('Bearer '.length);

    // Let UnauthorizedException propagate — the global exception filter converts
    // it to a 401. Catching and returning false would produce a 403 instead.
    const userId = await this.apiKeyService.validateApiKey(rawKey);
    (request as any).userId = userId;
    return true;
  }
}
