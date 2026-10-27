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
import { UserAuthenticationService } from './application/services/user-authentication.service';
import { MailModule } from '../infra/mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { PasswordResetService } from './application/services/password-reset.service';
import { UserBranchQueryService } from './application/services/user-branch-query.service';

// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    EventModule,
    MailModule,
    AuthModule,
  ],
  controllers: [UserController],
  providers: [
    PendingRegistrationService,
    UserRegistrationService,
    UserAuthenticationService,
    PasswordResetService,
    UserBranchQueryService,
  ],
  exports: [MongooseModule, UserBranchQueryService],
})
export class UserModule {}
