import { BadRequestException } from '@nestjs/common';
import {
  MSG_INVALID_MULTIPLIER,
  MSG_VALIDATION_FAILED,
  MULTIPLIER_MAX,
  MULTIPLIER_MAX_DECIMALS,
  MULTIPLIER_MIN,
  msg02,
} from '../../domain/constants/price-rule.constants';
import { toNumberOrKeep } from './to-number-or-keep.helper';

export interface MultiplierFieldError {
  field: string;
  message: string;
}

/** Hệ số hợp lệ: số hữu hạn, trong [MIN, MAX], tối đa 2 chữ số thập phân. */
export function isValidMultiplier(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < MULTIPLIER_MIN || value > MULTIPLIER_MAX) return false;
  const decimals = String(value).split('.')[1]?.length ?? 0;
  return decimals <= MULTIPLIER_MAX_DECIMALS;
}

/** Chuẩn hóa hệ số về tối đa 2 chữ số thập phân. */
export function normalizeMultiplier(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Kiểm tra trường `multiplier`: thiếu (MSG02) trước, sau đó giá trị không hợp lệ (AF-2).
 * Trả về lỗi (nếu có) hoặc undefined.
 */
export function validateMultiplier(
  input: unknown,
): MultiplierFieldError | undefined {
  const value = toNumberOrKeep({ value: input });
  if (value === undefined) {
    return { field: 'multiplier', message: msg02('Multiplier') };
  }
  if (!isValidMultiplier(value)) {
    return { field: 'multiplier', message: MSG_INVALID_MULTIPLIER };
  }
  return undefined;
}

/** Tạo BadRequestException có cấu trúc `errors[]` (contract 2.1). */
export function buildMultiplierValidationException(
  errors: MultiplierFieldError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: MSG_VALIDATION_FAILED,
    errors,
  });
}
