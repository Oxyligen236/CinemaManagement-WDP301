/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, NotFoundException } from '@nestjs/common';
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
import { Repository } from 'typeorm';
import { StorageEntity } from '../domain/entities/storage.entity';

@Injectable()
export class S3StorageService implements StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly storageRepo: Repository<StorageEntity>,
  ) {}

  async getUrlByStorageId(
    storageId: string,
  ): Promise<PresignedDowloadResponse> {
    const storage = await this.storageRepo.findOne({
      where: { storageKey: storageId },
    });

    if (!storage) {
      throw new NotFoundException(`Storage with ID ${storageId} not found`);
    }

    return this.getPresignedDowloadUrl(storage.storageKey);
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

    const record = StorageEntity.create({
      storageKey: req.key,
      originName: req.originalName,
      bucket: this.bucket,
      contentType: req.contentType,
      size: req.contentLength,
      etag,
    });
    const entity = await this.storageRepo.save(record);

    return {
      storageId: entity.storageKey,
      key: entity.storageKey,
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
    await this.storageRepo.delete({ storageKey: storageId });
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
