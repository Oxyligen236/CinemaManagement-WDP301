import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import {
  MSG_INVALID_DATE,
  MSG_INVALID_TIME,
  MSG_VALIDATION_FAILED,
  REQUIRED_FIELD_LABELS,
  msg01,
} from '../../domain/constants/showtime-management.constants';
import {
  ShowtimeFieldError,
  buildShowtimeValidationException,
} from '../../application/helpers/showtime-management-validation.helper';

const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

/** Thông điệp đầu tiên của lỗi (đi sâu vào lỗi lồng nhau nếu cần). */
function firstMessage(error: ValidationError): string {
  const constraint = Object.values(error.constraints ?? {})[0];
  if (constraint) return constraint;
  for (const child of error.children ?? []) {
    return firstMessage(child);
  }
  return MSG_VALIDATION_FAILED;
}

function toFieldError(error: ValidationError): ShowtimeFieldError {
  const label = REQUIRED_FIELD_LABELS[error.property];
  // Thiếu / null / chuỗi rỗng của 4 trường bắt buộc đều là MSG01
  if (label && isBlank(error.value)) {
    return { field: error.property, message: msg01(label) };
  }
  const constraints = error.constraints ?? {};
  if (error.property === 'screeningDate' && 'matches' in constraints) {
    return { field: error.property, message: MSG_INVALID_DATE };
  }
  if (error.property === 'startTime' && 'matches' in constraints) {
    return { field: error.property, message: MSG_INVALID_TIME };
  }
  return { field: error.property, message: firstMessage(error) };
}

/** Map ValidationError[] thành `errors[{ field, message }]` (contract 2.1). */
export function showtimeValidationExceptionFactory(
  validationErrors: ValidationError[],
): BadRequestException {
  return buildShowtimeValidationException(validationErrors.map(toFieldError));
}
