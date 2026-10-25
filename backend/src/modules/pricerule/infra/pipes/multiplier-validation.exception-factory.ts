import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import {
  MSG_INVALID_FIELD,
  MSG_INVALID_MULTIPLIER,
  msg02,
} from '../../domain/constants/price-rule.constants';
import {
  buildMultiplierValidationException,
  MultiplierFieldError,
} from '../../application/helpers/multiplier-validation.helper';

/** Map ValidationError[] thành `errors[]` (field = multiplier | group | fieldKey | ruleId; MSG02 ưu tiên). */
export function multiplierValidationExceptionFactory(
  validationErrors: ValidationError[],
): BadRequestException {
  const errors: MultiplierFieldError[] = validationErrors.map((error) => {
    const constraints = error.constraints ?? {};
    const fallback =
      error.property === 'multiplier'
        ? MSG_INVALID_MULTIPLIER
        : MSG_INVALID_FIELD;
    const message =
      'isDefined' in constraints && error.property === 'multiplier'
        ? msg02('Multiplier')
        : (Object.values(constraints)[0] ?? fallback);
    return { field: error.property, message };
  });
  return buildMultiplierValidationException(errors);
}
