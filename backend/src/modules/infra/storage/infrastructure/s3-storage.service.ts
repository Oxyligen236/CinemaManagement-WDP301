/*
https://docs.nestjs.com/providers#services
*/

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StorageService } from '../application/interface/storage.interface';
import {
  PresignedDowloadResponse,
  PresignedUploadResponse,
  PresignedUrlOptions,
  UploadRequest,
  UploadResponse,
} from '../dtos/dto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService implements StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly publicUrl: string = '',
  ) {}

  getPublicUrl(key: string): string {
    const base = this.publicUrl.trim().replace(/\/+$/, '');
    if (!base) {
      throw new InternalServerErrorException(
        'STORAGE_PUBLIC_URL chưa được cấu hình, không thể tạo URL công khai',
      );
    }
    return `${base}/${key.replace(/^\/+/, '')}`;
  }

  async getUrlByStorageId(
    storageId: string,
  ): Promise<PresignedDowloadResponse> {
    if (!(await this.exists(storageId))) {
      throw new NotFoundException(`Storage with ID ${storageId} not found`);
    }

    return this.getPresignedDowloadUrl(storageId);
  }

  async upload(req: UploadRequest): Promise<UploadResponse> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: req.key,
      Body: req.body,
      ContentType: req.contentType,
      ContentLength: req.contentLength,
      CacheControl: req.cacheControl,
      Metadata: req.metadata,
    });

    const result = await this.client.send(command);
    const etag = (result.ETag ?? '').replace(/"/g, '');

    return {
      storageId: req.key,
      key: req.key,
      etag,
      originalName: req.originalName,
    };
  }

  async delete(storageId: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageId,
      }),
    );
  }

  async exists(storageId: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageId,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  async getPresignedDowloadUrl(
    storageId: string,
    expiresIn?: number,
  ): Promise<PresignedDowloadResponse> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageId,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresIn ?? 3600,
    });

    return { storageId, key: storageId, url, expiresIn: expiresIn ?? 3600 };
  }

  uploadGetPresignedDowloadUrl(
    req: UploadRequest,
    expiresIn?: number,
  ): Promise<PresignedDowloadResponse> {
    return this.upload(req).then((uploadResponse) => {
      return this.getPresignedDowloadUrl(uploadResponse.storageId, expiresIn);
    });
  }

  async getPresignedUploadUrl(
    storageId: string,
    options?: PresignedUrlOptions,
  ): Promise<PresignedUploadResponse> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageId,
      ContentType: options?.contentType,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn ?? 3600,
    });

    return { storageId, key: storageId, url, options };
  }
}
