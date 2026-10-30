import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  MSG03,
  MSG_CREATE_SUCCESS,
  MSG_DELETE_SUCCESS,
  MSG_DUPLICATE_MULTIPLIER,
  MSG_INVALID_FIELD,
  MSG_INVALID_MULTIPLIER,
  MSG_MAX_VALUES,
  MSG_NOT_FOUND,
  MSG_SAVE_FAILED,
  msg02,
} from '../../domain/constants/price-rule.constants';
import { PriceGroup } from '../../domain/enums/price-group.enum';
import { PriceFieldResDto } from '../dto/res.dto';
import { PriceRuleOptionQueryService } from './price-rule-option-query.service';
import { PriceRuleValueService } from './price-rule-value.service';
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

const FIELD: PriceFieldResDto = {
  group: PriceGroup.SEAT,
  fieldKey: 'VIP',
  label: 'VIP Seat Multiplier',
  values: [{ ruleId: 'r-vip-15', multiplier: 1.5, updatedAt: T }],
};

describe('PriceRuleValueService', () => {
  let service: PriceRuleValueService;
  let mockPrisma: any;
  const optionQuery = { getPriceField: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    optionQuery.getPriceField.mockResolvedValue(FIELD);
    mockPrisma = {
      seatPriceRule: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(rule({ id: 'r-new', adjustmentValue: 1.7 })),
        update: jest.fn().mockResolvedValue(rule({ adjustmentValue: 1.8 })),
        delete: jest.fn().mockResolvedValue({}),
      },
      dayPriceRule: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(rule({ id: 'd1', adjustmentValue: 1.2, dayType: 'WEEKEND' })),
        update: jest.fn().mockResolvedValue(rule({ adjustmentValue: 1.8 })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };

    service = new PriceRuleValueService(
      mockPrisma as unknown as PrismaService,
      optionQuery as unknown as PriceRuleOptionQueryService,
    );
  });

  describe('createPriceValue', () => {
    it('thêm VIP 1.7 -> create đúng 1 lần, trả MSG_CREATE_SUCCESS + field', async () => {
      const res = await service.createPriceValue(PriceGroup.SEAT, 'VIP', {
        multiplier: 1.7,
      });
      expect(mockPrisma.seatPriceRule.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.seatPriceRule.create).toHaveBeenCalledWith({
        data: {
          seatType: 'VIP',
          adjustmentValue: 1.7,
        },
      });
      expect(res.message).toBe(MSG_CREATE_SUCCESS);
      expect(res.value).toEqual({
        ruleId: 'r-new',
        multiplier: 1.7,
        updatedAt: undefined,
      });
      expect(res.field).toBe(FIELD);
    });

    it('trường chưa có giá trị (count 0) -> thêm thành công', async () => {
      mockPrisma.seatPriceRule.count.mockResolvedValue(0);
      await expect(
        service.createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.2 }),
      ).resolves.toBeDefined();
    });

    it('nhóm DAY dùng dayModel với khóa dayType', async () => {
      await service.createPriceValue(PriceGroup.DAY, 'WEEKEND', {
        multiplier: 1.2,
      });
      expect(mockPrisma.dayPriceRule.create).toHaveBeenCalledWith({
        data: {
          dayType: 'WEEKEND',
          adjustmentValue: 1.2,
        },
      });
      expect(mockPrisma.seatPriceRule.create).not.toHaveBeenCalled();
    });

    it.each([undefined, null, ''])(
      'thiếu multiplier (%p) -> MSG02, không gọi DB',
      async (v) => {
        const err = await service
          .createPriceValue(PriceGroup.SEAT, 'VIP', {
            multiplier: v as unknown as number,
          })
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          errors: [{ field: 'multiplier', message: msg02('Multiplier') }],
        });
        expect(mockPrisma.seatPriceRule.count).not.toHaveBeenCalled();
        expect(mockPrisma.seatPriceRule.create).not.toHaveBeenCalled();
      },
    );

    it.each([0.8, 0, -1.2, 'abc', NaN, 11, 1.234, true])(
      'multiplier %p không hợp lệ -> MSG_INVALID_MULTIPLIER, không gọi DB',
      async (v) => {
        const err = await service
          .createPriceValue(PriceGroup.SEAT, 'VIP', {
            multiplier: v as unknown as number,
          })
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          errors: [{ field: 'multiplier', message: MSG_INVALID_MULTIPLIER }],
        });
        expect(mockPrisma.seatPriceRule.create).not.toHaveBeenCalled();
      },
    );

    it('chấp nhận "1.7" và chuẩn hóa như 1.7', async () => {
      await service.createPriceValue(PriceGroup.SEAT, 'VIP', {
        multiplier: '1.70' as unknown as number,
      });
      expect(mockPrisma.seatPriceRule.findFirst).toHaveBeenCalledWith({
        where: {
          seatType: 'VIP',
          adjustmentValue: 1.7,
        },
      });
      expect(mockPrisma.seatPriceRule.create).toHaveBeenCalledWith({
        data: {
          seatType: 'VIP',
          adjustmentValue: 1.7,
        },
      });
    });

    it('trùng giá trị -> ConflictException(MSG_DUPLICATE_MULTIPLIER), không create', async () => {
      mockPrisma.seatPriceRule.findFirst.mockResolvedValue({ id: 'x' });
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.5 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_DUPLICATE_MULTIPLIER);
      expect(mockPrisma.seatPriceRule.create).not.toHaveBeenCalled();
    });

    it('đủ 20 giá trị -> ConflictException(MSG_MAX_VALUES)', async () => {
      mockPrisma.seatPriceRule.count.mockResolvedValue(20);
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.9 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_MAX_VALUES);
      expect(mockPrisma.seatPriceRule.create).not.toHaveBeenCalled();
    });

    it.each([
      [PriceGroup.SEAT, 'STANDARD'],
      [PriceGroup.DAY, 'WEEKDAY'],
      [PriceGroup.SEAT, 'WEEKEND'],
    ])(
      'trường không hợp lệ (%s, %s) -> BadRequest MSG_INVALID_FIELD',
      async (g, k) => {
        const err = await service
          .createPriceValue(g, k, { multiplier: 1.5 })
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as Error).message).toBe(MSG_INVALID_FIELD);
      },
    );

    it('DB reject -> InternalServerErrorException(MSG_SAVE_FAILED)', async () => {
      mockPrisma.seatPriceRule.create.mockRejectedValue(new Error('db down'));
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.7 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_SAVE_FAILED);
    });
  });

  describe('updatePriceValue', () => {
    beforeEach(() => {
      mockPrisma.seatPriceRule.findFirst
        .mockResolvedValueOnce(rule()) // current
        .mockResolvedValueOnce(null); // not duplicated
      mockPrisma.seatPriceRule.update.mockResolvedValue(
        rule({ adjustmentValue: 1.8 }),
      );
    });

    it('sửa multiplier -> update đúng 1 lần, ruleId không đổi, trả MSG03', async () => {
      const res = await service.updatePriceValue(
        PriceGroup.SEAT,
        'VIP',
        'r-vip-15',
        { multiplier: 1.8 },
      );
      expect(mockPrisma.seatPriceRule.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.seatPriceRule.update).toHaveBeenCalledWith({
        where: { id: 'r-vip-15' },
        data: { adjustmentValue: 1.8 },
      });
      expect(res.message).toBe(MSG03);
      expect(res.value.ruleId).toBe('r-vip-15');
      expect(res.value.multiplier).toBe(1.8);
    });

    it('giữ nguyên giá trị hiện tại -> thành công (idempotent)', async () => {
      mockPrisma.seatPriceRule.findFirst.mockReset();
      mockPrisma.seatPriceRule.findFirst
        .mockResolvedValueOnce(rule())
        .mockResolvedValueOnce(null);
      mockPrisma.seatPriceRule.update.mockResolvedValue(rule());

      const res = await service.updatePriceValue(
        PriceGroup.SEAT,
        'VIP',
        'r-vip-15',
        { multiplier: 1.5 },
      );
      expect(res.message).toBe(MSG03);
    });

    it('trùng giá trị khác cùng trường -> 409', async () => {
      mockPrisma.seatPriceRule.findFirst.mockReset();
      mockPrisma.seatPriceRule.findFirst
        .mockResolvedValueOnce(rule())
        .mockResolvedValueOnce({ id: 'x' }); // duplicate found

      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', 'r-vip-15', {
          multiplier: 1.7,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_DUPLICATE_MULTIPLIER);
      expect(mockPrisma.seatPriceRule.update).not.toHaveBeenCalled();
    });

    it('ruleId không tồn tại / thuộc trường khác -> 404', async () => {
      mockPrisma.seatPriceRule.findFirst.mockReset();
      mockPrisma.seatPriceRule.findFirst.mockResolvedValue(null);

      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', 'nope', { multiplier: 1.7 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as Error).message).toBe(MSG_NOT_FOUND);
    });

    it('multiplier < 1.0 -> AF-2, không gọi DB', async () => {
      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', 'r-vip-15', {
          multiplier: 0.8,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(mockPrisma.seatPriceRule.findFirst).not.toHaveBeenCalled();
    });

    it('DB reject -> 500 MSG_SAVE_FAILED', async () => {
      mockPrisma.seatPriceRule.update.mockRejectedValue(new Error('db down'));

      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', 'r-vip-15', {
          multiplier: 1.8,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_SAVE_FAILED);
    });
  });

  describe('deletePriceValue', () => {
    beforeEach(() => {
      mockPrisma.seatPriceRule.findFirst.mockResolvedValue(rule());
      mockPrisma.seatPriceRule.delete.mockResolvedValue({});
    });

    it('xóa vật lý đúng 1 lần, trả MSG_DELETE_SUCCESS với giá trị vừa xóa', async () => {
      const res = await service.deletePriceValue(
        PriceGroup.SEAT,
        'VIP',
        'r-vip-15',
      );
      expect(mockPrisma.seatPriceRule.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.seatPriceRule.delete).toHaveBeenCalledWith({
        where: { id: 'r-vip-15' },
      });
      expect(res.message).toBe(MSG_DELETE_SUCCESS);
      expect(res.value.ruleId).toBe('r-vip-15');
      expect(res.field).toBe(FIELD);
    });

    it('xóa giá trị cuối cùng của trường -> được phép', async () => {
      optionQuery.getPriceField.mockResolvedValue({ ...FIELD, values: [] });
      const res = await service.deletePriceValue(
        PriceGroup.SEAT,
        'VIP',
        'r-vip-15',
      );
      expect(res.field.values).toEqual([]);
    });

    it('ruleId không tồn tại / thuộc trường khác -> 404', async () => {
      mockPrisma.seatPriceRule.findFirst.mockResolvedValue(null);

      const err = await service
        .deletePriceValue(PriceGroup.SEAT, 'VIP', 'nope')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect(mockPrisma.seatPriceRule.delete).not.toHaveBeenCalled();
    });
  });
});
