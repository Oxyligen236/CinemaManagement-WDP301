import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../../../auth/infra/decorators/role.decorator';
import { JwtGuard } from '../../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../../auth/infra/guards/role.guard';
import { Role } from '../../../../user/domain/enums/role.enum';
import { S3StorageService } from '../s3-storage.service';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PresignedDowloadResponse } from '../../dtos/dto';
import { StorageInterceptor } from '../interceptors/storage.interceptor';
import { StorageUpload } from '../decorators/storage-upload.decorator';
import { MAX_FILE_SIZE } from '../../storage.contanst';

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@Controller('storage')
@UseGuards(JwtGuard, RoleGuard)
@Roles(Role.ADMIN)
export class StorageController {
  constructor(private readonly storageService: S3StorageService) {}

  @Post('upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: 10 },
        { name: 'test', maxCount: 10 },
      ],
      { limits: { fileSize: MAX_FILE_SIZE } },
    ),
    StorageInterceptor,
  )
  @StorageUpload([
    {
      field: 'files',
      path: (req: { body?: { folderId?: string } }) =>
        `storage-test/${req.body?.folderId ?? ''}`,
    },
    {
      field: 'test',
      path: (req: { body?: { folderId?: string } }) =>
        `storage-test/${req.body?.folderId ?? ''}`,
    },
  ])
  @ApiConsumes('multipart/form-data')
  uploadFile(
    @Request()
    {
      files,
      test,
    }: { files: PresignedDowloadResponse[]; test: PresignedDowloadResponse[] },
    @Body() body: { a: string; b: string },
  ) {
    return {
      message: 'File uploaded successfully',
      body: body,
      files: files,
      test: test,
    };
  }

  @Get('url')
  @ApiQuery({
    name: 'key',
    required: true,
    type: String,
    example: 'storage-test/uuid.png',
  })
  @ApiOperation({ summary: 'Get a presigned image URL' })
  @ApiResponse({ status: 200, description: 'File URL retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or missing storage key' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden resource' })
  async getUrl(
    @Query('key') key?: string,
  ): Promise<{ key: string; url: string }> {
    if (!key) {
      throw new BadRequestException('Storage key is required');
    }
    return this.storageService.getPresignedUploadUrl(key, {
      expiresIn: 3600,
    });
  }

  @Get('url/:storageId')
  async getUrlByStorageId(
    @Param('storageId') storageId: string,
  ): Promise<PresignedDowloadResponse> {
    return this.storageService.getUrlByStorageId(storageId);
  }
}
