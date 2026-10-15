import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { TempModule } from './modules/temp/temp.module';
import { DatabaseModule } from './modules/infra/database/database.module';
import { EventModule } from './modules/infra/event/event.module';
import { MailModule } from './modules/infra/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    EventModule,
    MailModule,
    UserModule,
    TempModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
