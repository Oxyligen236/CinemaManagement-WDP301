import { CanActivate, Injectable } from '@nestjs/common';

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
