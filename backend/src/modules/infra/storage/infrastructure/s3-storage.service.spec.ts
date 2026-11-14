import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageService } from './s3-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3StorageService', () => {
  const send = jest.fn<Promise<unknown>, [unknown]>();
  const client = { send } as unknown as S3Client;
  const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<
    typeof getSignedUrl
  >;
  let service: S3StorageService;

  beforeEach(() => {
    send.mockReset();
    mockGetSignedUrl.mockReset();
    service = new S3StorageService(client, 'test-bucket', 'https://cdn.test//');
  });

  describe('getPublicUrl', () => {
    it('builds normalized URL trimming trailing base slashes and leading key slashes', () => {
      expect(service.getPublicUrl('/movies/poster.jpg')).toBe(
        'https://cdn.test/movies/poster.jpg',
      );
    });

    it('throws InternalServerErrorException when publicUrl is blank or default', () => {
      const blankService = new S3StorageService(client, 'test-bucket', '   ');
      const defaultService = new S3StorageService(client, 'test-bucket');

      expect(() => blankService.getPublicUrl('a.jpg')).toThrow(
        InternalServerErrorException,
      );
      expect(() => defaultService.getPublicUrl('a.jpg')).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getUrlByStorageId', () => {
    it('returns presigned download URL when object exists', async () => {
      send.mockResolvedValueOnce({});
      mockGetSignedUrl.mockResolvedValueOnce('https://signed.test/download');

      const result = await service.getUrlByStorageId('movies/poster.jpg');

      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
      expect(result).toEqual({
        storageId: 'movies/poster.jpg',
        key: 'movies/poster.jpg',
        url: 'https://signed.test/download',
        expiresIn: 3600,
      });
    });

    it('throws NotFoundException when object does not exist', async () => {
      send.mockRejectedValueOnce(new Error('NotFound'));

      await expect(service.getUrlByStorageId('missing.jpg')).rejects.toThrow(
        new NotFoundException('Storage with ID missing.jpg not found'),
      );
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('uploads object and strips quotes from ETag', async () => {
      send.mockResolvedValueOnce({ ETag: '"etag-123"' });

      const result = await service.upload({
        key: 'movies/1.jpg',
        body: Buffer.from('abc'),
        originalName: '1.jpg',
        contentType: 'image/jpeg',
        contentLength: 3,
        cacheControl: 'max-age=3600',
        metadata: { source: 'test' },
      });

      expect(result).toEqual({
        storageId: 'movies/1.jpg',
        key: 'movies/1.jpg',
        etag: 'etag-123',
        originalName: '1.jpg',
      });
      const cmd = send.mock.calls[0][0] as PutObjectCommand;
      expect(cmd).toBeInstanceOf(PutObjectCommand);
      expect(cmd.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'movies/1.jpg',
        CacheControl: 'max-age=3600',
        Metadata: { source: 'test' },
      });
    });

    it('defaults etag to empty string when S3 response omits ETag', async () => {
      send.mockResolvedValueOnce({});

      const result = await service.upload({
        key: 'movies/2.jpg',
        body: Buffer.from('abc'),
        originalName: '2.jpg',
        contentType: 'image/jpeg',
        contentLength: 3,
      });

      expect(result.etag).toBe('');
    });
  });

  describe('delete & exists', () => {
    it('sends DeleteObjectCommand on delete', async () => {
      send.mockResolvedValueOnce({});

      await service.delete('movies/old.jpg');

      const cmd = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(cmd).toBeInstanceOf(DeleteObjectCommand);
      expect(cmd.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'movies/old.jpg',
      });
    });

    it('returns true when HeadObjectCommand succeeds and false on error', async () => {
      send.mockResolvedValueOnce({});
      await expect(service.exists('a.jpg')).resolves.toBe(true);

      send.mockRejectedValueOnce(new Error('404'));
      await expect(service.exists('a.jpg')).resolves.toBe(false);
    });
  });

  describe('getPresignedDowloadUrl & uploadGetPresignedDowloadUrl', () => {
    it('generates presigned download URL with default 3600s and custom expiresIn', async () => {
      mockGetSignedUrl
        .mockResolvedValueOnce('https://signed.test/default')
        .mockResolvedValueOnce('https://signed.test/custom');

      const defaultRes = await service.getPresignedDowloadUrl('k1');
      expect(defaultRes).toEqual({
        storageId: 'k1',
        key: 'k1',
        url: 'https://signed.test/default',
        expiresIn: 3600,
      });
      expect(mockGetSignedUrl.mock.calls[0][1]).toBeInstanceOf(
        GetObjectCommand,
      );
      expect(mockGetSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 3600 });

      const customRes = await service.getPresignedDowloadUrl('k2', 900);
      expect(customRes).toEqual({
        storageId: 'k2',
        key: 'k2',
        url: 'https://signed.test/custom',
        expiresIn: 900,
      });
      expect(mockGetSignedUrl.mock.calls[1][2]).toEqual({ expiresIn: 900 });
    });

    it('uploads file and returns presigned download URL', async () => {
      send.mockResolvedValueOnce({ ETag: '"e1"' });
      mockGetSignedUrl.mockResolvedValueOnce('https://signed.test/uploaded');

      const res = await service.uploadGetPresignedDowloadUrl(
        {
          key: 'movies/p.jpg',
          body: Buffer.from('img'),
          originalName: 'p.jpg',
          contentType: 'image/jpeg',
          contentLength: 3,
        },
        600,
      );

      expect(res).toEqual({
        storageId: 'movies/p.jpg',
        key: 'movies/p.jpg',
        url: 'https://signed.test/uploaded',
        expiresIn: 600,
      });
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('generates presigned upload URL with default options and custom options', async () => {
      mockGetSignedUrl
        .mockResolvedValueOnce('https://signed.test/upload-default')
        .mockResolvedValueOnce('https://signed.test/upload-custom');

      const defaultRes = await service.getPresignedUploadUrl('uploads/1.png');
      expect(defaultRes).toEqual({
        storageId: 'uploads/1.png',
        key: 'uploads/1.png',
        url: 'https://signed.test/upload-default',
        options: undefined,
      });
      expect(mockGetSignedUrl.mock.calls[0][1]).toBeInstanceOf(
        PutObjectCommand,
      );
      expect(mockGetSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 3600 });

      const customOpts = { contentType: 'image/png', expiresIn: 1800 };
      const customRes = await service.getPresignedUploadUrl(
        'uploads/2.png',
        customOpts,
      );
      expect(customRes).toEqual({
        storageId: 'uploads/2.png',
        key: 'uploads/2.png',
        url: 'https://signed.test/upload-custom',
        options: customOpts,
      });
      const putCmd = mockGetSignedUrl.mock.calls[1][1] as PutObjectCommand;
      expect(putCmd.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'uploads/2.png',
        ContentType: 'image/png',
      });
      expect(mockGetSignedUrl.mock.calls[1][2]).toEqual({ expiresIn: 1800 });
    });
  });
});
