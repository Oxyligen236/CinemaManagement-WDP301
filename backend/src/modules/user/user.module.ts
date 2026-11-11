import { Module } from '@nestjs/common';
import { EventModule } from '../infra/event/event.module';
import { UserController } from './infra/user.controller';
import { PendingRegistrationService } from './application/services/pending-registration.service';
import { UserRegistrationService } from './application/services/user-registration.service';
import { UserAuthenticationService } from './application/services/user-authentication.service';
import { MailModule } from '../infra/mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { PasswordResetService } from './application/services/password-reset.service';
import { UserBranchQueryService } from './application/services/user-branch-query.service';
import { UserProfileQueryService } from './application/services/user-profile-query.service';
import { UserProfileCommandService } from './application/services/user-profile-command.service';
import { ChangePasswordService } from './application/services/change-password.service';

@Module({
  imports: [EventModule, MailModule, AuthModule],
  controllers: [UserController],
  providers: [
    PendingRegistrationService,
    UserRegistrationService,
    UserAuthenticationService,
    PasswordResetService,
    UserBranchQueryService,
    UserProfileQueryService,
    UserProfileCommandService,
    ChangePasswordService,
  ],
  exports: [
    UserBranchQueryService,
    UserProfileQueryService,
    UserProfileCommandService,
    ChangePasswordService,
  ],
})
export class UserModule {}
