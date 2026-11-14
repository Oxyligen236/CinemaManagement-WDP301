import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import {
  MSG_INVALID_DATE,
  MSG_INVALID_TIME,
  MSG_VALIDATION_FAILED,
  msg01,
} from '../domain/constants/showtime-management.constants';
import {
  buildShowtimeValidationException,
  showtimeValidationExceptionFactory,
} from './save-showtime-validation.exception-factory';

describe('save-showtime-validation.exception-factory', () => {
  it('buildShowtimeValidationException wraps errors in BadRequestException', () => {
    const ex = buildShowtimeValidationException([
      { field: 'movieId', message: 'Required' },
    ]);

    expect(ex).toBeInstanceOf(BadRequestException);
    expect(ex.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: MSG_VALIDATION_FAILED,
      errors: [{ field: 'movieId', message: 'Required' }],
    });
  });

  it('maps missing required fields (undefined, null, blank string) to msg01(label)', () => {
    const errors: ValidationError[] = [
      { property: 'movieId', value: undefined },
      { property: 'screeningDate', value: null },
      { property: 'startTime', value: '   ' },
      { property: 'roomId', value: '' },
    ];

    const ex = showtimeValidationExceptionFactory(errors);
    expect((ex.getResponse() as { errors: unknown[] }).errors).toEqual([
      { field: 'movieId', message: msg01('Movie') },
      { field: 'screeningDate', message: msg01('Date') },
      { field: 'startTime', message: msg01('Start time') },
      { field: 'roomId', message: msg01('Screening room') },
    ]);
  });

  it('maps non-missing invalid fields using INVALID_MESSAGES, label fallback, constraint, or default', () => {
    const errors: ValidationError[] = [
      { property: 'screeningDate', value: 'bad-date' },
      { property: 'startTime', value: '99:99' },
      { property: 'movieId', value: 123 },
      { property: 'basePrice', value: -10 },
      {
        property: 'keyword',
        value: 'x',
        constraints: { maxLength: 'Too long' },
      },
      { property: 'unknownField', value: 'y' },
    ];

    const ex = showtimeValidationExceptionFactory(errors);
    expect((ex.getResponse() as { errors: unknown[] }).errors).toEqual([
      { field: 'screeningDate', message: MSG_INVALID_DATE },
      { field: 'startTime', message: MSG_INVALID_TIME },
      { field: 'movieId', message: 'The Movie field is invalid.' },
      { field: 'basePrice', message: 'Base price is invalid.' },
      { field: 'keyword', message: 'Too long' },
      { field: 'unknownField', message: MSG_VALIDATION_FAILED },
    ]);
  });
});
