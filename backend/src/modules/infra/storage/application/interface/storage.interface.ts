import {
  PresignedDowloadResponse,
  PresignedUploadResponse,
  PresignedUrlOptions,
  UploadRequest,
  UploadResponse,
} from '../../dtos/dto';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StorageService {
  upload(req: UploadRequest): Promise<UploadResponse>;

  delete(storageId: string): Promise<void>;

  exists(storageId: string): Promise<boolean>;

  getPresignedDowloadUrl(
    storageId: string,
    expiresIn?: number,
  ): Promise<PresignedDowloadResponse>;

  uploadGetPresignedDowloadUrl(
    req: UploadRequest,
    expiresIn?: number,
  ): Promise<PresignedDowloadResponse>;

  getPresignedUploadUrl(
    storageId: string,
    options?: PresignedUrlOptions,
  ): Promise<PresignedUploadResponse>;

  getUrlByStorageId(storageId: string): Promise<PresignedDowloadResponse>;
}
