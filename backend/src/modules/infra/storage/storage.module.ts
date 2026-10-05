import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../../auth/auth.module';
import { StorageController } from './infrastructure/controllers/storage.controller';
import { S3Client } from '@aws-sdk/client-s3';
import { STORAGE_SERVICE } from './application/interface/storage.interface';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageEntity } from './domain/entities/storage.entity';
import { StorageInterceptor } from './infrastructure/interceptors/storage.interceptor';
import { StorageListener } from './infrastructure/listeners/storage.listener';
import { DeleteStorageHandler } from './application/handlers/delete-storage.handler';

@Global()
@Module({
  imports: [
    AuthModule,
    ConfigModule,
    TypeOrmModule.forFeature([StorageEntity]),
  ],
  controllers: [StorageController],
  providers: [
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          endpoint: config.get<string>('STORAGE_ENDPOINT'),
          region: config.get<string>('STORAGE_REGION', 'auto'),
          forcePathStyle:
            config.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true',
          credentials: {
            accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY_ID'),
            secretAccessKey: config.getOrThrow<string>(
              'STORAGE_SECRET_ACCESS_KEY',
            ),
          },
        }),
    },
    {
      provide: STORAGE_SERVICE,
      inject: [S3Client, ConfigService, getRepositoryToken(StorageEntity)],
      useFactory: (
        client: S3Client,
        config: ConfigService,
        storageRepo: Repository<StorageEntity>,
      ) =>
        new S3StorageService(
          client,
          config.getOrThrow<string>('STORAGE_BUCKET'),
          storageRepo,
        ),
    },
    {
      provide: S3StorageService,
      useExisting: STORAGE_SERVICE,
    },
    {
      provide: 'STORAGE_SERVICE',
      useExisting: STORAGE_SERVICE,
    },
    DeleteStorageHandler,
    StorageInterceptor,
    StorageListener,
  ],
  exports: [
    STORAGE_SERVICE,
    'STORAGE_SERVICE',
    S3StorageService,
    S3Client,
    DeleteStorageHandler,
    StorageInterceptor,
    StorageListener,
  ],
})
export class StorageModule {}
