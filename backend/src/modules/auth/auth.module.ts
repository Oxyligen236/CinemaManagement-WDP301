import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './infra/guards/jwt.guard';
import { RoleGuard } from './infra/guards/role.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'change-this-development-secret',
        ),
        signOptions: {
          expiresIn: Number(config.get('JWT_EXPIRES_IN_SECONDS', 86400)),
        },
      }),
    }),
  ],
  providers: [JwtGuard, RoleGuard],
  exports: [JwtModule, JwtGuard, RoleGuard],
})
export class AuthModule {}
