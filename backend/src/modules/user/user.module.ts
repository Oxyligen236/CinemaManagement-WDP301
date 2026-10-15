/* eslint-disable prettier/prettier */
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventModule } from '../infra/event/event.module';
import { User, UserSchema } from './domain/schemas/user.schema';
import { UserController } from './infra/user.controller';
import { PendingRegistrationService } from './application/services/pending-registration.service';
import { UserRegistrationService } from './application/services/user-registration.service';
import { UserAuthenticationService } from './application/services/user-authentication.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EventModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-this-development-secret'),
        signOptions: {
          expiresIn: config.get<number>('JWT_EXPIRES_IN_SECONDS', 86400),
        },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [
    PendingRegistrationService,
    UserRegistrationService,
    UserAuthenticationService,
  ],
})
export class UserModule {}
