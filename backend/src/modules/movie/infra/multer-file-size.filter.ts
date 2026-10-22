import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';
import { MSG09 } from '../domain/constants/movie-asset.constants';

/**
 * Bắt lỗi PayloadTooLargeException (từ Multer khi file vượt ngưỡng kích thước)
 * và chuyển đổi thành HTTP 400 Bad Request với thông điệp MSG09 chuẩn.
 */
@Catch(PayloadTooLargeException)
export class MulterFileSizeExceptionFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: MSG09,
      error: 'Bad Request',
    });
  }
}
