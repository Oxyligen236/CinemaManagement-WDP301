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

  /**
   * Trả về URL công khai (không ký) của object: `${STORAGE_PUBLIC_URL}/${key}`.
   * Chỉ dùng cho bucket/prefix public (ví dụ poster, banner).
   *
   * @param key - Object key trong bucket
   * @returns URL công khai, đã chuẩn hóa dấu '/' dư
   * @throws InternalServerErrorException khi chưa cấu hình STORAGE_PUBLIC_URL
   */
  getPublicUrl(key: string): string;

  getUrlByStorageId(storageId: string): Promise<PresignedDowloadResponse>;
}
