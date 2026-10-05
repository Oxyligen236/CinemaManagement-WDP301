import { Module } from '@nestjs/common';
import { JwtGuard } from './infra/guards/jwt.guard';
import { RoleGuard } from './infra/guards/role.guard';

@Module({
  providers: [JwtGuard, RoleGuard],
  exports: [JwtGuard, RoleGuard],
})
export class AuthModule {}
