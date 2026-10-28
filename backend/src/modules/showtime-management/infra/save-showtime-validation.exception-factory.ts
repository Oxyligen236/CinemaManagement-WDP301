import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import {
  MSG_INVALID_DATE,
  MSG_INVALID_TIME,
  MSG_VALIDATION_FAILED,
  msg01,
} from '../domain/constants/showtime-management.constants';

export type ShowtimeFieldError = { field: string; message: string };

const REQUIRED_LABELS: Record<string, string> = {
  movieId: 'Movie',
  screeningDate: 'Date',
  startTime: 'Start time',
  roomId: 'Screening room',
};

const INVALID_MESSAGES: Record<string, string> = {
  screeningDate: MSG_INVALID_DATE,
  startTime: MSG_INVALID_TIME,
  basePrice: 'Base price is invalid.',
  priceSelections: 'Price selection is invalid.',
  date: MSG_INVALID_DATE,
  includePast: 'includePast is invalid.',
};

const isMissing = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

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

/** Map ValidationError[] thành `errors[]`: thiếu -> MSG01, sai định dạng -> thông điệp riêng của trường. */
export function showtimeValidationExceptionFactory(
  validationErrors: ValidationError[],
): BadRequestException {
  const errors = validationErrors.map((error): ShowtimeFieldError => {
    const label = REQUIRED_LABELS[error.property];
    if (label && isMissing(error.value)) {
      return { field: error.property, message: msg01(label) };
    }
    const message =
      INVALID_MESSAGES[error.property] ??
      (label ? `The ${label} field is invalid.` : undefined) ??
      Object.values(error.constraints ?? {})[0] ??
      MSG_VALIDATION_FAILED;
    return { field: error.property, message };
  });
  return buildShowtimeValidationException(errors);
}
