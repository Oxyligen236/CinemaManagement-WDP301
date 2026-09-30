import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/infra/database/database.module';
import { TempModule } from './modules/temp/temp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    TempModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
