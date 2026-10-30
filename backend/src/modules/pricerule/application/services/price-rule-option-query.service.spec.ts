import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  MSG_INVALID_SELECTION,
  MSG_LOAD_FAILED,
} from '../../domain/constants/price-rule.constants';
import { DayType } from '../../domain/enums/day-type.enum';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { SeatType } from '../../domain/enums/seat-type.enum';
import { DayPriceRule } from '../../domain/schemas/day-price-rule.schema';
import { SeatPriceRule } from '../../domain/schemas/seat-price-rule.schema';
import { PriceRuleOptionQueryService } from './price-rule-option-query.service';

const T = new Date('2026-10-23T00:00:00Z');
const RULE_ID_1 = '507f1f77bcf86cd799439011';
const RULE_ID_2 = '507f1f77bcf86cd799439012';

const rule = (o: Partial<Record<string, unknown>> = {}) => ({
  _id: RULE_ID_1,
  seatType: 'VIP',
  adjustmentValue: 1.5,
  createdAt: T,
  updatedAt: T,
  ...o,
});
const chain = (result: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(result),
});

describe('PriceRuleOptionQueryService', () => {
  let service: PriceRuleOptionQueryService;
  const seatModel = { find: jest.fn(), findOne: jest.fn() };
  const dayModel = { find: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PriceRuleOptionQueryService,
        { provide: getModelToken(SeatPriceRule.name), useValue: seatModel },
        { provide: getModelToken(DayPriceRule.name), useValue: dayModel },
      ],
    }).compile();
    service = moduleRef.get(PriceRuleOptionQueryService);
  });

  describe('listPriceValues', () => {
    it('trả đủ 4 trường theo thứ tự cố định, map adjustmentValue -> multiplier, trường rỗng -> values []', async () => {
      seatModel.find.mockImplementation((q: { seatType: string }) =>
        chain(
          q.seatType === 'VIP'
            ? [rule(), rule({ _id: RULE_ID_2, adjustmentValue: 1.7 })]
            : [],
        ),
      );
      dayModel.find.mockReturnValue(chain([]));

      const result = await service.listPriceValues();

      expect(result.map((f) => f.fieldKey)).toEqual([
        'VIP',
        'COUPLE',
        'WEEKEND',
        'HOLIDAY',
      ]);
      expect(result.map((f) => f.group)).toEqual([
        PriceGroup.SEAT,
        PriceGroup.SEAT,
        PriceGroup.DAY,
        PriceGroup.DAY,
      ]);
      expect(result[0].label).toBe('VIP Seat Multiplier');
      expect(result[0].values).toEqual([
        { ruleId: RULE_ID_1, multiplier: 1.5, updatedAt: T },
        { ruleId: RULE_ID_2, multiplier: 1.7, updatedAt: T },
      ]);
      expect(result[1].values).toEqual([]);
      expect(result[2].values).toEqual([]);
      expect(result[3].values).toEqual([]);
    });

    it('lọc adjustmentValue >= 1 và sắp tăng dần', async () => {
      const c = chain([]);
      seatModel.find.mockReturnValue(c);
      dayModel.find.mockReturnValue(chain([]));
      await service.listPriceValues();
      expect(seatModel.find).toHaveBeenCalledWith({
        seatType: 'VIP',
        adjustmentValue: { $gte: 1 },
      });
      expect(c.sort).toHaveBeenCalledWith({ adjustmentValue: 1 });
    });

    it('lỗi DB -> InternalServerErrorException(MSG_LOAD_FAILED)', async () => {
      seatModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('mongo down')),
      });
      dayModel.find.mockReturnValue(chain([]));
      const err = await service.listPriceValues().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_LOAD_FAILED);
    });
  });

  describe('resolvePriceSelections', () => {
    it('chọn VIP 1.7 -> snapshot VIP; trường còn lại ruleId null, multiplier 1.0', async () => {
      seatModel.findOne.mockReturnValue(
        chain(rule({ _id: RULE_ID_2, adjustmentValue: 1.7 })),
      );
      const result = await service.resolvePriceSelections([
        { group: PriceGroup.SEAT, fieldKey: 'VIP', ruleId: RULE_ID_2 },
      ]);
      expect(seatModel.findOne).toHaveBeenCalledWith({
        _id: RULE_ID_2,
        seatType: 'VIP',
        adjustmentValue: { $gte: 1 },
      });
      expect(result).toEqual({
        seatPriceSelections: [
          { seatType: SeatType.VIP, ruleId: RULE_ID_2, multiplier: 1.7 },
          { seatType: SeatType.COUPLE, ruleId: null, multiplier: 1.0 },
        ],
        dayPriceSelections: [
          { dayType: DayType.WEEKEND, ruleId: null, multiplier: 1.0 },
          { dayType: DayType.HOLIDAY, ruleId: null, multiplier: 1.0 },
        ],
      });
    });

    it('không chọn gì -> đủ 4 trường mặc định 1.0, không gọi DB', async () => {
      const result = await service.resolvePriceSelections([]);
      expect(seatModel.findOne).not.toHaveBeenCalled();
      expect(dayModel.findOne).not.toHaveBeenCalled();
      expect(
        [...result.seatPriceSelections, ...result.dayPriceSelections].every(
          (s) => s.ruleId === null && s.multiplier === 1.0,
        ),
      ).toBe(true);
      expect(result.seatPriceSelections).toHaveLength(2);
      expect(result.dayPriceSelections).toHaveLength(2);
    });

    it('ruleId không tồn tại / thuộc trường khác -> BadRequest MSG_INVALID_SELECTION', async () => {
      dayModel.findOne.mockReturnValue(chain(null));
      const err = await service
        .resolvePriceSelections([
          { group: PriceGroup.DAY, fieldKey: 'WEEKEND', ruleId: 'r-vip-15' },
        ])
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe(MSG_INVALID_SELECTION);
    });

    it('trường lặp trong input -> BadRequest MSG_INVALID_SELECTION', async () => {
      const err = await service
        .resolvePriceSelections([
          { group: PriceGroup.SEAT, fieldKey: 'VIP', ruleId: 'a' },
          { group: PriceGroup.SEAT, fieldKey: 'VIP', ruleId: 'b' },
        ])
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe(MSG_INVALID_SELECTION);
      expect(seatModel.findOne).not.toHaveBeenCalled();
    });

    it('fieldKey STANDARD không cấu hình được -> BadRequest MSG_INVALID_SELECTION', async () => {
      const err = await service
        .resolvePriceSelections([
          { group: PriceGroup.SEAT, fieldKey: 'STANDARD', ruleId: 'a' },
        ])
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as Error).message).toBe(MSG_INVALID_SELECTION);
    });
  });
});
