/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventModule } from '../infra/event/event.module';
import { User, UserSchema } from './domain/schemas/user.schema';
import { UserController } from './infra/user.controller';
import { PendingRegistrationService } from './application/services/pending-registration.service';
import { UserRegistrationService } from './application/services/user-registration.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EventModule,
  ],
  controllers: [UserController],
  providers: [PendingRegistrationService, UserRegistrationService],
})
export class UserModule {}
