import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { StorageController } from './infrastructure/controllers/storage.controller';
import { S3Client } from '@aws-sdk/client-s3';
import { STORAGE_SERVICE } from './application/interface/storage.interface';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { StorageInterceptor } from './infrastructure/interceptors/storage.interceptor';
import { StorageListener } from './infrastructure/listeners/storage.listener';
import { DeleteStorageHandler } from './application/handlers/delete-storage.handler';

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
@Global()
@Module({
  imports: [ConfigModule],
  // controllers: [StorageController],
  providers: [
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Không ném lỗi khi thiếu credential để app vẫn boot; S3 sẽ lỗi khi gọi thật.
        const missing = [
          'STORAGE_ENDPOINT',
          'STORAGE_ACCESS_KEY_ID',
          'STORAGE_SECRET_ACCESS_KEY',
          'STORAGE_BUCKET',
        ].filter((name) => !config.get<string>(name));
        if (missing.length) {
          new Logger('StorageModule').warn(
            `Thiếu cấu hình storage: ${missing.join(', ')}. Upload/Delete S3 sẽ thất bại.`,
          );
        }
        return new S3Client({
          endpoint: config.get<string>('STORAGE_ENDPOINT'),
          region: config.get<string>('STORAGE_REGION', 'auto'),
          forcePathStyle:
            config.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true',
          credentials: {
            accessKeyId: config.get<string>('STORAGE_ACCESS_KEY_ID', ''),
            secretAccessKey: config.get<string>(
              'STORAGE_SECRET_ACCESS_KEY',
              '',
            ),
          },
        });
      },
    },
    {
      provide: STORAGE_SERVICE,
      inject: [S3Client, ConfigService],
      useFactory: (client: S3Client, config: ConfigService) =>
        new S3StorageService(
          client,
          config.get<string>('STORAGE_BUCKET', ''),
          config.get<string>('STORAGE_PUBLIC_URL', ''),
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
