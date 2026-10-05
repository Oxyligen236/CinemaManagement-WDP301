import { CanActivate, Injectable } from '@nestjs/common';

@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
