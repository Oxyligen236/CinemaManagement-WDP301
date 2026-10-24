import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  MSG_NO_BRANCH,
  MSG_VALIDATION_FAILED,
} from '../../domain/constants/showtime-management.constants';

export interface ShowtimeFieldError {
  field: string;
  message: string;
}

/** Tạo BadRequestException có cấu trúc `errors[]` (contract 2.1). */
export function buildShowtimeValidationException(
  errors: ShowtimeFieldError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: MSG_VALIDATION_FAILED,
    errors,
  });
}

/** Lỗi 400 cho đúng 1 trường. */
export function fieldValidationException(
  field: string,
  message: string,
): BadRequestException {
  return buildShowtimeValidationException([{ field, message }]);
}

/** Lấy branchId của Manager; không có -> 403 MSG_NO_BRANCH. */
export async function requireBranchId(
  userBranchQuery: {
    getBranchIdOfUser(userId: string): Promise<string | null>;
  },
  userId: string,
): Promise<string> {
  const branchId = await userBranchQuery.getBranchIdOfUser(userId);
  if (!branchId) throw new ForbiddenException(MSG_NO_BRANCH);
  return branchId;
}

/** HttpException giữ nguyên; lỗi lạ -> log và đổi thành 500 với thông báo chung (không rò rỉ stack). */
export function toHttpError(
  logger: Logger,
  error: unknown,
  message: string,
): HttpException {
  if (error instanceof HttpException) return error;
  logger.error(message, error instanceof Error ? error.stack : String(error));
  return new InternalServerErrorException(message);
}
