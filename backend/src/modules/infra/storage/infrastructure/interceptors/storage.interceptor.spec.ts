import {
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { StorageService } from '../../application/interface/storage.interface';
import { FILE_PATH, FILES_PATH } from '../../storage.contanst';
import { StorageUploadOption } from '../decorators/storage-upload.decorator';
import { StorageInterceptor } from './storage.interceptor';

const makeFile = (
  fieldname: string,
  originalname: string,
): Express.Multer.File =>
  ({
    fieldname,
    originalname,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 4,
    buffer: Buffer.from('data'),
  }) as Express.Multer.File;

describe('StorageInterceptor', () => {
  let interceptor: StorageInterceptor;
  let storageService: {
    uploadGetPresignedDowloadUrl: jest.Mock<Promise<unknown>, [unknown]>;
  };
  let reflector: { get: jest.Mock };
  let nextHandleMock: jest.Mock;
  let next: CallHandler;

  const createContext = (req: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => function handler() {},
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    storageService = {
      uploadGetPresignedDowloadUrl: jest.fn<Promise<unknown>, [unknown]>(),
    };
    reflector = {
      get: jest.fn(),
    };
    nextHandleMock = jest.fn(() => of('next-result'));
    next = {
      handle: nextHandleMock,
    };
    interceptor = new StorageInterceptor(
      storageService as unknown as StorageService,
      reflector as unknown as Reflector,
    );
  });

  it('passes through directly when STORAGE_OPTIONS metadata is missing or empty', async () => {
    reflector.get.mockReturnValueOnce(undefined);
    await interceptor.intercept(createContext({}), next);

    reflector.get.mockReturnValueOnce([]);
    await interceptor.intercept(createContext({}), next);

    expect(storageService.uploadGetPresignedDowloadUrl).not.toHaveBeenCalled();
    expect(nextHandleMock).toHaveBeenCalledTimes(2);
  });

  it('uploads single req.file using matching option and dynamic path resolver', async () => {
    const options: StorageUploadOption[] = [
      { field: 'other', path: 'others' },
      {
        field: 'poster',
        path: (req) => `movies/${(req.params as Record<string, string>).id}`,
      },
    ];
    reflector.get.mockReturnValue(options);
    const uploaded = {
      storageId: 'movies/m1/uuid-poster.jpg',
      key: 'movies/m1/uuid-poster.jpg',
      url: 'https://cdn.test/poster.jpg',
    };
    storageService.uploadGetPresignedDowloadUrl.mockResolvedValue(uploaded);
    const req: Record<string, unknown> = {
      params: { id: 'm1' },
      [FILE_PATH]: makeFile('poster', 'poster.jpg'),
    };

    await interceptor.intercept(createContext(req), next);

    const callArg = storageService.uploadGetPresignedDowloadUrl.mock
      .calls[0][0] as {
      key: string;
      body: Buffer;
      originalName: string;
      contentType: string;
      contentLength: number;
    };
    expect(callArg.key).toMatch(/^movies\/m1\/[0-9a-f-]+-poster\.jpg$/);
    expect(callArg).toMatchObject({
      body: Buffer.from('data'),
      originalName: 'poster.jpg',
      contentType: 'image/jpeg',
      contentLength: 4,
    });
    expect(req[FILE_PATH]).toEqual(uploaded);
    expect(nextHandleMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to options[0] when single file fieldname does not match any option', async () => {
    reflector.get.mockReturnValue([{ field: 'avatar', path: 'avatars' }]);
    const uploaded = {
      storageId: 'avatars/1-file.png',
      key: 'avatars/1-file.png',
      url: 'https://cdn.test/file.png',
    };
    storageService.uploadGetPresignedDowloadUrl.mockResolvedValue(uploaded);
    const req: Record<string, unknown> = {
      [FILE_PATH]: makeFile('unknown', 'file.png'),
    };

    await interceptor.intercept(createContext(req), next);

    const callArg = storageService.uploadGetPresignedDowloadUrl.mock
      .calls[0][0] as { key: string };
    expect(callArg.key).toMatch(/^avatars\/[0-9a-f-]+-file\.png$/);
    expect(req[FILE_PATH]).toEqual(uploaded);
  });

  it('uploads array req.files when non-empty and falls back to options[0] if field not found', async () => {
    reflector.get.mockReturnValue([
      { field: 'gallery', path: 'movies/gallery' },
    ]);
    const uploaded1 = {
      storageId: 'k1',
      key: 'k1',
      url: 'https://cdn.test/1.jpg',
    };
    const uploaded2 = {
      storageId: 'k2',
      key: 'k2',
      url: 'https://cdn.test/2.jpg',
    };
    storageService.uploadGetPresignedDowloadUrl
      .mockResolvedValueOnce(uploaded1)
      .mockResolvedValueOnce(uploaded2);
    const req: Record<string, unknown> = {
      [FILES_PATH]: [makeFile('other', '1.jpg'), makeFile('other', '2.jpg')],
    };

    await interceptor.intercept(createContext(req), next);

    expect(storageService.uploadGetPresignedDowloadUrl).toHaveBeenCalledTimes(
      2,
    );
    expect(req[FILES_PATH]).toEqual([uploaded1, uploaded2]);
  });

  it('matches field option for array req.files and skips upload when array is empty', async () => {
    reflector.get.mockReturnValue([
      { field: 'other', path: 'other' },
      { field: 'photos', path: 'branches' },
    ]);
    const uploaded = {
      storageId: 'k1',
      key: 'k1',
      url: 'https://cdn.test/1.jpg',
    };
    storageService.uploadGetPresignedDowloadUrl.mockResolvedValue(uploaded);

    const nonEmptyReq: Record<string, unknown> = {
      [FILES_PATH]: [makeFile('photos', '1.jpg')],
    };
    await interceptor.intercept(createContext(nonEmptyReq), next);
    const callArg = storageService.uploadGetPresignedDowloadUrl.mock
      .calls[0][0] as { key: string };
    expect(callArg.key).toMatch(/^branches\/[0-9a-f-]+-1\.jpg$/);

    storageService.uploadGetPresignedDowloadUrl.mockClear();
    const emptyReq: Record<string, unknown> = {
      [FILES_PATH]: [],
    };
    await interceptor.intercept(createContext(emptyReq), next);
    expect(storageService.uploadGetPresignedDowloadUrl).not.toHaveBeenCalled();
    expect(nextHandleMock).toHaveBeenCalledTimes(2);
  });

  it('uploads Record<string, File[]> fields that have files and skips empty ones', async () => {
    reflector.get.mockReturnValue([
      { field: 'poster', path: 'movies/posters' },
      { field: 'banner', path: 'movies/banners' },
      { field: 'trailer', path: 'movies/trailers' },
    ]);
    const posterRes = { storageId: 'p1', key: 'p1', url: 'u1' };
    storageService.uploadGetPresignedDowloadUrl.mockResolvedValue(posterRes);

    const filesDict: Record<string, unknown> = {
      poster: [makeFile('poster', 'p.jpg')],
      banner: [],
    };
    const req: Record<string, unknown> = {
      [FILES_PATH]: filesDict,
    };

    await interceptor.intercept(createContext(req), next);

    expect(storageService.uploadGetPresignedDowloadUrl).toHaveBeenCalledTimes(
      1,
    );
    expect(filesDict.poster).toEqual([posterRes]);
    expect(filesDict.banner).toEqual([]);
    expect(nextHandleMock).toHaveBeenCalledTimes(1);
  });

  it('passes through when neither file nor files are attached to request', async () => {
    reflector.get.mockReturnValue([{ field: 'poster', path: 'movies' }]);
    const req: Record<string, unknown> = {};

    await interceptor.intercept(createContext(req), next);

    expect(storageService.uploadGetPresignedDowloadUrl).not.toHaveBeenCalled();
    expect(nextHandleMock).toHaveBeenCalledTimes(1);
  });

  it('wraps Error and non-Error upload failures in InternalServerErrorException', async () => {
    reflector.get.mockReturnValue([{ field: 'poster', path: 'movies' }]);
    storageService.uploadGetPresignedDowloadUrl.mockRejectedValueOnce(
      new Error('S3 unavailable'),
    );

    await expect(
      interceptor.intercept(
        createContext({ [FILE_PATH]: makeFile('poster', 'a.jpg') }),
        next,
      ),
    ).rejects.toThrow(
      new InternalServerErrorException('Upload file thất bại: S3 unavailable'),
    );

    storageService.uploadGetPresignedDowloadUrl.mockRejectedValueOnce(
      'unexpected-failure',
    );

    await expect(
      interceptor.intercept(
        createContext({ [FILE_PATH]: makeFile('poster', 'a.jpg') }),
        next,
      ),
    ).rejects.toThrow(
      new InternalServerErrorException('Upload file thất bại: Unknown error'),
    );
  });
});
