import { Readable } from 'node:stream';
import 'multer';

export class UploadRequest {
  key!: string;
  body!: Buffer | Uint8Array | Readable;
  originalName?: string;
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
  metadata?: Record<string, string>;

  static toDto(file: Express.Multer.File, key: string): UploadRequest {
    return {
      key,
      body: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
      contentLength: file.size,
    };
  }
}

export class UploadResponse {
  storageId!: string;
  etag!: string;
  originalName?: string;
  key!: string;
}

export class PresignedDowloadResponse {
  storageId!: string;
  url!: string;
  expiresIn?: number;
  key!: string;
}

export class PresignedUploadResponse {
  storageId!: string;
  url!: string;
  options?: PresignedUrlOptions;
  key!: string;
}

export class PresignedUrlOptions {
  expiresIn?: number;
  contentType?: string;
}
