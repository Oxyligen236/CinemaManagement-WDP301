import 'reflect-metadata';
import { Request } from 'express';
import {
  STORAGE_OPTIONS,
  StorageUpload,
  StorageUploadOption,
} from './storage-upload.decorator';

describe('StorageUpload decorator', () => {
  it('attaches STORAGE_OPTIONS metadata to the decorated handler', () => {
    const pathResolver = (req: Request) => `users/${String(req.params.id)}`;
    const options: StorageUploadOption[] = [
      { field: 'poster', path: 'movies' },
      { field: 'avatar', path: pathResolver },
    ];

    class DummyController {
      @StorageUpload(options)
      uploadFiles() {
        return true;
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      DummyController.prototype,
      'uploadFiles',
    );
    const metadata = Reflect.getMetadata(
      STORAGE_OPTIONS,
      descriptor!.value as object,
    ) as StorageUploadOption[];

    expect(metadata).toEqual(options);
    expect(metadata[1].path).toBe(pathResolver);
  });
});
