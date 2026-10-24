import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { showtimeValidationExceptionFactory } from '../../infra/pipes/showtime-validation.exception-factory';
import {
  MovieOptionSearchReqDto,
  SaveShowtimeReqDto,
  SearchManagedShowtimeReqDto,
} from './req.dto';

const VALID = {
  movieId: 'm-1',
  screeningDate: '2026-10-25',
  startTime: '09:30',
  roomId: 'r-1',
};

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  stopAtFirstError: true,
  exceptionFactory: showtimeValidationExceptionFactory,
});

async function transformBody(body: unknown): Promise<SaveShowtimeReqDto> {
  return (await pipe.transform(body, {
    type: 'body',
    metatype: SaveShowtimeReqDto,
  })) as SaveShowtimeReqDto;
}

async function errorsOf(
  body: unknown,
): Promise<{ field: string; message: string }[]> {
  try {
    await transformBody(body);
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    const res = (e as BadRequestException).getResponse() as {
      statusCode: number;
      error: string;
      message: string;
      errors: { field: string; message: string }[];
    };
    expect(res.statusCode).toBe(400);
    expect(res.message).toBe('Validation failed');
    return res.errors;
  }
  throw new Error('expected validation error');
}

describe('showtime-management req DTO', () => {
  it('hợp lệ -> không lỗi', async () => {
    const dto = plainToInstance(SaveShowtimeReqDto, VALID);
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    ['movieId', 'Movie'],
    ['screeningDate', 'Date'],
    ['startTime', 'Start time'],
    ['roomId', 'Screening room'],
  ])('thiếu %s -> MSG01 nhãn %s', async (field, label) => {
    for (const value of [undefined, '', null]) {
      const body: Record<string, unknown> = { ...VALID };
      if (value === undefined) delete body[field];
      else body[field] = value;
      expect(await errorsOf(body)).toEqual([
        { field, message: `The ${label} field is required.` },
      ]);
    }
  });

  it('ngày sai định dạng -> MSG_INVALID_DATE', async () => {
    expect(await errorsOf({ ...VALID, screeningDate: '25/10/2026' })).toEqual([
      { field: 'screeningDate', message: 'Screening date is invalid.' },
    ]);
  });

  it.each(['9:30', '24:00', '09:60'])(
    'giờ %s sai -> MSG_INVALID_TIME',
    async (startTime) => {
      expect(await errorsOf({ ...VALID, startTime })).toEqual([
        { field: 'startTime', message: 'Start time is invalid. Use HH:mm.' },
      ]);
    },
  );

  it('whitelist loại field lạ (endTime, branchId, showtimeId)', async () => {
    const dto = await transformBody({
      ...VALID,
      endTime: '2026-10-25T05:16:00Z',
      branchId: 'branch-b',
      showtimeId: 'st-x',
    });
    expect(dto).toEqual(expect.objectContaining(VALID));
    expect(dto).not.toHaveProperty('endTime');
    expect(dto).not.toHaveProperty('branchId');
    expect(dto).not.toHaveProperty('showtimeId');
  });

  it('basePrice âm -> lỗi field basePrice', async () => {
    const errors = await errorsOf({ ...VALID, basePrice: -1 });
    expect(errors[0].field).toBe('basePrice');
  });

  it('basePrice chuỗi số -> chuyển thành số', async () => {
    const dto = await transformBody({ ...VALID, basePrice: '90000' });
    expect(dto.basePrice).toBe(90000);
  });

  it('priceSelections sai group -> lỗi field priceSelections', async () => {
    const errors = await errorsOf({
      ...VALID,
      priceSelections: [{ group: 'FOO', fieldKey: 'VIP', ruleId: 'a' }],
    });
    expect(errors[0].field).toBe('priceSelections');
  });

  it('priceSelections hợp lệ được giữ nguyên', async () => {
    const dto = await transformBody({
      ...VALID,
      priceSelections: [{ group: 'SEAT', fieldKey: 'VIP', ruleId: 'a1' }],
    });
    expect(dto.priceSelections).toEqual([
      { group: 'SEAT', fieldKey: 'VIP', ruleId: 'a1' },
    ]);
  });

  it('SearchManagedShowtimeReqDto: includePast "true" -> boolean, page/limit mặc định', async () => {
    const dto = plainToInstance(SearchManagedShowtimeReqDto, {
      includePast: 'true',
    });
    expect(dto.includePast).toBe(true);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('SearchManagedShowtimeReqDto: date sai định dạng bị từ chối', async () => {
    const dto = plainToInstance(SearchManagedShowtimeReqDto, {
      date: '25-10-2026',
    });
    const errors = await validate(dto);
    expect(errors[0].property).toBe('date');
  });

  it('MovieOptionSearchReqDto: keyword > 100 ký tự bị từ chối; mặc định phân trang', async () => {
    const ok = plainToInstance(MovieOptionSearchReqDto, { keyword: 'dun' });
    expect(ok.page).toBe(1);
    expect(ok.limit).toBe(10);
    expect(await validate(ok)).toHaveLength(0);
    const bad = plainToInstance(MovieOptionSearchReqDto, {
      keyword: 'a'.repeat(101),
    });
    expect((await validate(bad))[0].property).toBe('keyword');
  });
});
