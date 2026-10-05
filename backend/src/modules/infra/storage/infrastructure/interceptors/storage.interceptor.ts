/*
https://docs.nestjs.com/interceptors#interceptors
*/

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { STORAGE_SERVICE } from '../../application/interface/storage.interface';
import type { StorageService } from '../../application/interface/storage.interface';
import { Reflector } from '@nestjs/core';
import { StorageUploadOption } from '../decorators/storage-upload.decorator';
import { PresignedDowloadResponse, UploadRequest } from '../../dtos/dto';
import { Request } from 'express';
import 'multer';
import { randomUUID } from 'crypto';
import { FILE_PATH, FILES_PATH } from '../../storage.contanst';

interface StorageRequest extends Request {
  [FILE_PATH]?: Express.Multer.File;
  [FILES_PATH]?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
}

@Injectable()
export class StorageInterceptor implements NestInterceptor {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
    private readonly reflector: Reflector,
  ) {}

  private resolvePath(
    path: string | ((req: Request) => string),
    req: Request,
  ): string {
    return typeof path === 'function' ? path(req) : path;
  }

  private async uploadFiles(
    files: Express.Multer.File[],
    path: string,
  ): Promise<PresignedDowloadResponse[]> {
    try {
      return await Promise.all(
        files.map((file) => {
          const key = `${path}/${randomUUID()}-${file.originalname}`;

          const dto: UploadRequest = {
            key,
            body: file.buffer,
            originalName: file.originalname,
            contentType: file.mimetype,
            contentLength: file.size,
          };

          return this.storageService.uploadGetPresignedDowloadUrl(dto);
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Upload file thất bại: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get<StorageUploadOption[]>(
      'STORAGE_OPTIONS',
      context.getHandler(),
    );

    if (!options?.length) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<StorageRequest>();

    // 1. FileInterceptor: req.file
    const singleFile = req[FILE_PATH];
    if (singleFile?.buffer) {
      console.log('Is FileInterceptor');

      const file = singleFile;

      console.log('File:', file);

      const opt = options.find((o) => o.field === file.fieldname) || options[0];
      const path = this.resolvePath(opt.path, req);
      const [res] = await this.uploadFiles([file], path);
      (req as unknown as Record<string, unknown>)[FILE_PATH] = res;
      return next.handle();
    }

    // 2. FilesInterceptor: req.files is Array
    const filesList = req[FILES_PATH];
    if (Array.isArray(filesList)) {
      if (filesList.length > 0) {
        const opt =
          options.find((o) => o.field === filesList[0].fieldname) || options[0];
        const path = this.resolvePath(opt.path, req);
        (req as unknown as Record<string, unknown>)[FILES_PATH] =
          await this.uploadFiles(filesList, path);
      }
      return next.handle();
    }

    // 3. FileFieldsInterceptor: req.files is Record<string, File[]>
    if (filesList && typeof filesList === 'object') {
      const filesDict = filesList;
      for (const opt of options) {
        const files = filesDict[opt.field];
        if (!files?.length) continue;

        const path = this.resolvePath(opt.path, req);
        (filesDict as unknown as Record<string, unknown>)[opt.field] =
          await this.uploadFiles(files, path);
      }
      return next.handle();
    }

    return next.handle();
  }
}
