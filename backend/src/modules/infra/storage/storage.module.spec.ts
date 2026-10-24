import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';
import { StorageModule } from './storage.module';
import {
  STORAGE_SERVICE,
  type StorageService,
} from './application/interface/storage.interface';
import { S3StorageService } from './infrastructure/s3-storage.service';

const fakeEnv = {
  STORAGE_ENDPOINT: 'https://s3.example.test',
  STORAGE_REGION: 'auto',
  STORAGE_ACCESS_KEY_ID: 'fake-key',
  STORAGE_SECRET_ACCESS_KEY: 'fake-secret',
  STORAGE_BUCKET: 'test-bucket',
  STORAGE_PUBLIC_URL: 'https://cdn.example.test/',
};

describe('StorageModule', () => {
  it('resolves STORAGE_SERVICE without any TypeOrmModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => fakeEnv],
        }),
        StorageModule,
      ],
    }).compile();

    const service = moduleRef.get<StorageService>(STORAGE_SERVICE);
    expect(service).toBeInstanceOf(S3StorageService);
    expect(service.getPublicUrl('/movies/a.jpg')).toBe(
      'https://cdn.example.test/movies/a.jpg',
    );
    await moduleRef.close();
  });
});

describe('S3StorageService', () => {
  const send = jest.fn<Promise<unknown>, [unknown]>();
  const client = { send } as unknown as S3Client;
  let service: S3StorageService;

  beforeEach(() => {
    send.mockReset();
    service = new S3StorageService(client, 'bkt', 'https://cdn.test//');
  });

  it('getPublicUrl trims duplicate slashes', () => {
    expect(service.getPublicUrl('//a/b.png')).toBe('https://cdn.test/a/b.png');
  });

  it('getPublicUrl throws when public url is empty', () => {
    const s = new S3StorageService(client, 'bkt', '');
    expect(() => s.getPublicUrl('a')).toThrow(InternalServerErrorException);
  });

  it('upload uses the caller key and returns it', async () => {
    send.mockResolvedValue({ ETag: '"abc"' });
    const res = await service.upload({
      key: 'movies/1/poster.jpg',
      body: Buffer.from('x'),
      originalName: 'poster.jpg',
      contentType: 'image/jpeg',
      contentLength: 1,
    });
    expect(res).toEqual({
      storageId: 'movies/1/poster.jpg',
      key: 'movies/1/poster.jpg',
      etag: 'abc',
      originalName: 'poster.jpg',
    });
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: 'bkt',
      Key: 'movies/1/poster.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('exists uses HeadObject and returns false on error', async () => {
    send.mockResolvedValueOnce({});
    await expect(service.exists('k')).resolves.toBe(true);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    send.mockRejectedValueOnce(new Error('NotFound'));
    await expect(service.exists('k')).resolves.toBe(false);
  });

  it('delete uses DeleteObject', async () => {
    send.mockResolvedValue({});
    await service.delete('k');
    const cmd = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toEqual({ Bucket: 'bkt', Key: 'k' });
  });
});
