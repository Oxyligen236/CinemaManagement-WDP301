import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MSG_INVALID_FIELD,
  MSG_INVALID_MULTIPLIER,
  MSG_NOT_FOUND,
  msg02,
} from '../../domain/constants/price-rule.constants';
import { multiplierValidationExceptionFactory } from '../../infra/pipes/multiplier-validation.exception-factory';
import {
  CreatePriceValueReqDto,
  PriceFieldParamDto,
  PriceValueParamDto,
  UpdatePriceValueReqDto,
} from './req.dto';

async function check<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, {
    whitelist: true,
    stopAtFirstError: true,
  });
  return { dto, errors };
}

describe.each([
  ['CreatePriceValueReqDto', CreatePriceValueReqDto],
  ['UpdatePriceValueReqDto', UpdatePriceValueReqDto],
])('%s', (_name, cls) => {
  it.each([1, 1.0, 1.5, '1.7', 2.25, 10])('chấp nhận %p', async (v) => {
    const { errors, dto } = await check(cls, { multiplier: v });
    expect(errors).toHaveLength(0);
    expect(dto.multiplier).toBe(Number(v));
  });

  it.each([0.8, 0, -1.2, 'abc', 1.234, 11, NaN, Infinity, true, []])(
    'từ chối %p bằng thông điệp AF-2',
    async (v) => {
      const { errors } = await check(cls, { multiplier: v });
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('multiplier');
      expect(Object.values(errors[0].constraints ?? {})).toEqual([
        MSG_INVALID_MULTIPLIER,
      ]);
    },
  );

  it('thiếu multiplier -> MSG02', async () => {
    for (const missing of [undefined, null, '']) {
      const { errors } = await check(cls, { multiplier: missing });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toEqual({
        isDefined: msg02('Multiplier'),
      });
    }
  });

  it('whitelist loại trường lạ (ruleId...)', async () => {
    const dto = plainToInstance(cls, { multiplier: 1.5, ruleId: 'x', foo: 1 });
    await validate(dto, { whitelist: true });
    expect(Object.keys(dto)).toEqual(['multiplier']);
  });
});

describe('Param DTOs', () => {
  it('group không hợp lệ -> MSG_INVALID_FIELD', async () => {
    const { errors } = await check(PriceFieldParamDto, {
      group: 'FOO',
      fieldKey: 'VIP',
    });
    expect(errors[0].property).toBe('group');
    expect(Object.values(errors[0].constraints ?? {})).toEqual([
      MSG_INVALID_FIELD,
    ]);
  });

  it('group hợp lệ + fieldKey chuỗi -> pass', async () => {
    const { errors } = await check(PriceFieldParamDto, {
      group: 'SEAT',
      fieldKey: 'VIP',
    });
    expect(errors).toHaveLength(0);
  });

  it('ruleId rỗng -> MSG_NOT_FOUND', async () => {
    const { errors } = await check(PriceValueParamDto, {
      group: 'SEAT',
      fieldKey: 'VIP',
      ruleId: '',
    });
    expect(errors[0].property).toBe('ruleId');
    expect(Object.values(errors[0].constraints ?? {})).toEqual([MSG_NOT_FOUND]);
  });
});

describe('multiplierValidationExceptionFactory', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: multiplierValidationExceptionFactory,
  });

  it('body sai -> errors[] field multiplier', async () => {
    await expect(
      pipe.transform(
        { multiplier: 'abc' },
        { type: 'body', metatype: CreatePriceValueReqDto },
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: [{ field: 'multiplier', message: MSG_INVALID_MULTIPLIER }],
      },
    });
  });

  it('body thiếu -> MSG02', async () => {
    await expect(
      pipe.transform({}, { type: 'body', metatype: UpdatePriceValueReqDto }),
    ).rejects.toMatchObject({
      response: {
        errors: [{ field: 'multiplier', message: msg02('Multiplier') }],
      },
    });
  });

  it('param group sai -> errors[] field group', async () => {
    await expect(
      pipe.transform(
        { group: 'FOO', fieldKey: 'VIP' },
        { type: 'param', metatype: PriceFieldParamDto },
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [{ field: 'group', message: MSG_INVALID_FIELD }],
      },
    });
  });
});
