import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export type PathResolver = (req: Request) => string;

export interface StorageUploadOption {
  field: string;
  path: string | PathResolver;
}

export const STORAGE_OPTIONS = 'STORAGE_OPTIONS';

export const StorageUpload = (options: StorageUploadOption[]) => {
  return SetMetadata(STORAGE_OPTIONS, options);
};
