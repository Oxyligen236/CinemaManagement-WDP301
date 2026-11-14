import { BadRequestException, ValidationError } from '@nestjs/common';
import { multiplierValidationExceptionFactory } from './multiplier-validation.exception-factory';
import {
  MSG_INVALID_FIELD,
  MSG_INVALID_MULTIPLIER,
  MSG_VALIDATION_FAILED,
  msg02,
} from '../../domain/constants/price-rule.constants';

describe('multiplierValidationExceptionFactory', () => {
  it('uses msg02 for isDefined on multiplier', () => {
    const errors: ValidationError[] = [
      {
        property: 'multiplier',
        constraints: { isDefined: 'should not be null' },
      },
    ];
    const ex = multiplierValidationExceptionFactory(errors);
    expect(ex).toBeInstanceOf(BadRequestException);
    expect(ex.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: MSG_VALIDATION_FAILED,
      errors: [{ field: 'multiplier', message: msg02('Multiplier') }],
    });
  });

  it('uses constraint message when present', () => {
    const errors: ValidationError[] = [
      {
        property: 'multiplier',
        constraints: { isNumber: 'Must be numeric' },
      },
    ];
    const ex = multiplierValidationExceptionFactory(errors);
    expect(ex.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: MSG_VALIDATION_FAILED,
      errors: [{ field: 'multiplier', message: 'Must be numeric' }],
    });
  });

  it('falls back when constraints missing or empty for multiplier and other fields', () => {
    const errors: ValidationError[] = [
      { property: 'multiplier' },
      { property: 'fieldKey', constraints: {} },
    ];
    const ex = multiplierValidationExceptionFactory(errors);
    expect(ex.getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: MSG_VALIDATION_FAILED,
      errors: [
        { field: 'multiplier', message: MSG_INVALID_MULTIPLIER },
        { field: 'fieldKey', message: MSG_INVALID_FIELD },
      ],
    });
  });
});
