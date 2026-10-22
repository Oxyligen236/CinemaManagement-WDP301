import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

// Module chỉ được import Module cấm import thứ khác
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/wdp'),
        autoCreate: config.get<string>('DB_SYNC', 'true') === 'true',
        autoIndex: config.get<string>('DB_SYNC', 'true') === 'true',
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  // Tạo collection/index còn thiếu và xoá index không còn trong schema
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('DB_SYNC', 'true') !== 'true') {
      return;
    }
    await this.connection.syncIndexes();
    this.logger.log('Mongoose schema synchronized with database');
  }
}