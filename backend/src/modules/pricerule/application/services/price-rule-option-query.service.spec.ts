import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  MSG_INVALID_SELECTION,
  MSG_LOAD_FAILED,
} from '../../domain/constants/price-rule.constants';
import { DayType, SeatType } from '@prisma/client';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { PriceRuleOptionQueryService } from './price-rule-option-query.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const T = new Date('2026-10-23T00:00:00Z');
const rule = (o: Partial<Record<string, unknown>> = {}) => ({
  id: 'r-vip-15',
  seatType: 'VIP',
  adjustmentValue: 1.5,
  createdAt: T,
  updatedAt: T,
  ...o,
});

describe('PriceRuleOptionQueryService', () => {
  let service: PriceRuleOptionQueryService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.resetAllMocks();
    mockPrisma = {
      seatPriceRule: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      dayPriceRule: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new PriceRuleOptionQueryService(mockPrisma as unknown as PrismaService);
  });

  describe('listPriceValues', () => {
    it('trả đủ 4 trường theo thứ tự cố định, map adjustmentValue -> multiplier, trường rỗng -> values []', async () => {
      mockPrisma.seatPriceRule.findMany.mockImplementation((args: any) =>
        Promise.resolve(
          args.where.seatType === 'VIP'
            ? [rule(), rule({ id: 'r-vip-17', adjustmentValue: 1.7 })]
            : [],
        ),
      );
      mockPrisma.dayPriceRule.findMany.mockResolvedValue([]);

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
        { ruleId: 'r-vip-15', multiplier: 1.5, updatedAt: undefined },
        { ruleId: 'r-vip-17', multiplier: 1.7, updatedAt: undefined },
      ]);
      expect(result[1].values).toEqual([]);
      expect(result[2].values).toEqual([]);
      expect(result[3].values).toEqual([]);
    });

    it('lọc adjustmentValue >= 1 và sắp tăng dần', async () => {
      mockPrisma.seatPriceRule.findMany.mockResolvedValue([]);
      mockPrisma.dayPriceRule.findMany.mockResolvedValue([]);

      await service.listPriceValues();

      expect(mockPrisma.seatPriceRule.findMany).toHaveBeenCalledWith({
        where: {
          seatType: 'VIP',
          adjustmentValue: { gte: 1 },
        },
        orderBy: { adjustmentValue: 'asc' },
      });
    });

    it('lỗi DB -> InternalServerErrorException(MSG_LOAD_FAILED)', async () => {
      mockPrisma.seatPriceRule.findMany.mockRejectedValue(new Error('db down'));

      const err = await service.listPriceValues().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_LOAD_FAILED);
    });
  });

  describe('resolvePriceSelections', () => {
    it('chọn VIP 1.7 -> snapshot VIP; trường còn lại ruleId null, multiplier 1.0', async () => {
      mockPrisma.seatPriceRule.findFirst.mockResolvedValue(
        rule({ id: 'r-vip-17', adjustmentValue: 1.7 }),
      );

      const result = await service.resolvePriceSelections([
        { group: PriceGroup.SEAT, fieldKey: 'VIP', ruleId: 'r-vip-17' },
      ]);

      expect(mockPrisma.seatPriceRule.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'r-vip-17',
          seatType: 'VIP',
          adjustmentValue: { gte: 1 },
        },
      });
      expect(result).toEqual({
        seatPriceSelections: [
          { seatType: SeatType.VIP, ruleId: 'r-vip-17', multiplier: 1.7 },
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
      expect(mockPrisma.seatPriceRule.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.dayPriceRule.findFirst).not.toHaveBeenCalled();
      expect(
        [...result.seatPriceSelections, ...result.dayPriceSelections].every(
          (s) => s.ruleId === null && s.multiplier === 1.0,
        ),
      ).toBe(true);
      expect(result.seatPriceSelections).toHaveLength(2);
      expect(result.dayPriceSelections).toHaveLength(2);
    });

    it('ruleId không tồn tại / thuộc trường khác -> BadRequest MSG_INVALID_SELECTION', async () => {
      mockPrisma.dayPriceRule.findFirst.mockResolvedValue(null);

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
      expect(mockPrisma.seatPriceRule.findFirst).not.toHaveBeenCalled();
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
