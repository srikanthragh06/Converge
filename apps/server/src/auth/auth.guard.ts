import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Let UnauthorizedException propagate — the global exception filter converts
    // it to a 401. Catching and returning false would produce a 403 instead.
    await this.authService.verifyReqAuthAndAttachUserToReq(request);
    return true;
  }
}
