import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
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
import { DayPriceRule } from '../../domain/schemas/day-price-rule.schema';
import { SeatPriceRule } from '../../domain/schemas/seat-price-rule.schema';
import { PriceFieldResDto } from '../dto/res.dto';
import { PriceRuleOptionQueryService } from './price-rule-option-query.service';
import { PriceRuleValueService } from './price-rule-value.service';

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
const failing = () => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockRejectedValue(new Error('mongo down')),
});

const FIELD: PriceFieldResDto = {
  group: PriceGroup.SEAT,
  fieldKey: 'VIP',
  label: 'VIP Seat Multiplier',
  values: [{ ruleId: RULE_ID_1, multiplier: 1.5, updatedAt: T }],
};

const newModel = () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  exists: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
});

describe('PriceRuleValueService', () => {
  let service: PriceRuleValueService;
  let seatModel: ReturnType<typeof newModel>;
  let dayModel: ReturnType<typeof newModel>;
  const optionQuery = { getPriceField: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    seatModel = newModel();
    dayModel = newModel();
    optionQuery.getPriceField.mockResolvedValue(FIELD);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PriceRuleValueService,
        { provide: getModelToken(SeatPriceRule.name), useValue: seatModel },
        { provide: getModelToken(DayPriceRule.name), useValue: dayModel },
        { provide: PriceRuleOptionQueryService, useValue: optionQuery },
      ],
    }).compile();
    service = moduleRef.get(PriceRuleValueService);
  });

  describe('createPriceValue', () => {
    beforeEach(() => {
      seatModel.countDocuments.mockReturnValue(chain(1));
      seatModel.exists.mockReturnValue(chain(null));
      seatModel.create.mockResolvedValue(
        rule({ _id: RULE_ID_2, adjustmentValue: 1.7 }),
      );
    });

    it('thêm VIP 1.7 -> create đúng 1 lần, trả MSG_CREATE_SUCCESS + field', async () => {
      const res = await service.createPriceValue(PriceGroup.SEAT, 'VIP', {
        multiplier: 1.7,
      });
      expect(seatModel.create).toHaveBeenCalledTimes(1);
      expect(seatModel.create).toHaveBeenCalledWith({
        seatType: 'VIP',
        adjustmentValue: 1.7,
      });
      expect(res.message).toBe(MSG_CREATE_SUCCESS);
      expect(res.value).toEqual({
        ruleId: RULE_ID_2,
        multiplier: 1.7,
        updatedAt: T,
      });
      expect(res.field).toBe(FIELD);
    });

    it('trường chưa có giá trị (count 0) -> thêm thành công', async () => {
      seatModel.countDocuments.mockReturnValue(chain(0));
      await expect(
        service.createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.2 }),
      ).resolves.toBeDefined();
    });

    it('nhóm DAY dùng dayModel với khóa dayType', async () => {
      dayModel.countDocuments.mockReturnValue(chain(0));
      dayModel.exists.mockReturnValue(chain(null));
      dayModel.create.mockResolvedValue(
        rule({ _id: RULE_ID_2, adjustmentValue: 1.2, dayType: 'WEEKEND' }),
      );
      await service.createPriceValue(PriceGroup.DAY, 'WEEKEND', {
        multiplier: 1.2,
      });
      expect(dayModel.create).toHaveBeenCalledWith({
        dayType: 'WEEKEND',
        adjustmentValue: 1.2,
      });
      expect(seatModel.create).not.toHaveBeenCalled();
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
        expect(seatModel.countDocuments).not.toHaveBeenCalled();
        expect(seatModel.create).not.toHaveBeenCalled();
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
        expect(seatModel.create).not.toHaveBeenCalled();
      },
    );

    it('chấp nhận "1.7" và chuẩn hóa như 1.7', async () => {
      await service.createPriceValue(PriceGroup.SEAT, 'VIP', {
        multiplier: '1.70' as unknown as number,
      });
      expect(seatModel.exists).toHaveBeenCalledWith({
        seatType: 'VIP',
        adjustmentValue: 1.7,
      });
      expect(seatModel.create).toHaveBeenCalledWith({
        seatType: 'VIP',
        adjustmentValue: 1.7,
      });
    });

    it('trùng giá trị -> ConflictException(MSG_DUPLICATE_MULTIPLIER), không create', async () => {
      seatModel.exists.mockReturnValue(chain({ _id: 'x' }));
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.5 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_DUPLICATE_MULTIPLIER);
      expect(seatModel.create).not.toHaveBeenCalled();
    });

    it('đủ 20 giá trị -> ConflictException(MSG_MAX_VALUES)', async () => {
      seatModel.countDocuments.mockReturnValue(chain(20));
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.9 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_MAX_VALUES);
      expect(seatModel.create).not.toHaveBeenCalled();
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
      seatModel.create.mockRejectedValue(new Error('mongo down'));
      const err = await service
        .createPriceValue(PriceGroup.SEAT, 'VIP', { multiplier: 1.7 })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_SAVE_FAILED);
    });
  });

  describe('updatePriceValue', () => {
    beforeEach(() => {
      seatModel.findOne.mockReturnValue(chain(rule()));
      seatModel.exists.mockReturnValue(chain(null));
      seatModel.findOneAndUpdate.mockReturnValue(
        chain(rule({ adjustmentValue: 1.8 })),
      );
    });

    it('sửa multiplier -> findOneAndUpdate đúng 1 lần, ruleId không đổi, trả MSG03', async () => {
      const res = await service.updatePriceValue(
        PriceGroup.SEAT,
        'VIP',
        RULE_ID_1,
        { multiplier: 1.8 },
      );
      expect(seatModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(seatModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: RULE_ID_1, seatType: 'VIP' },
        { $set: { adjustmentValue: 1.8 } },
        { new: true },
      );
      expect(seatModel.exists).toHaveBeenCalledWith({
        seatType: 'VIP',
        adjustmentValue: 1.8,
        _id: { $ne: expect.anything() },
      });
      expect(res.message).toBe(MSG03);
      expect(res.value.ruleId).toBe(RULE_ID_1);
      expect(res.value.multiplier).toBe(1.8);
    });

    it('giữ nguyên giá trị hiện tại -> thành công (idempotent)', async () => {
      seatModel.findOneAndUpdate.mockReturnValue(chain(rule()));
      const res = await service.updatePriceValue(
        PriceGroup.SEAT,
        'VIP',
        RULE_ID_1,
        { multiplier: 1.5 },
      );
      expect(res.message).toBe(MSG03);
    });

    it('trùng giá trị khác cùng trường -> 409', async () => {
      seatModel.exists.mockReturnValue(chain({ _id: 'x' }));
      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', RULE_ID_1, {
          multiplier: 1.7,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as Error).message).toBe(MSG_DUPLICATE_MULTIPLIER);
      expect(seatModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('ruleId không tồn tại / thuộc trường khác -> 404', async () => {
      seatModel.findOne.mockReturnValue(chain(null));
      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', '507f1f77bcf86cd799439099', {
          multiplier: 1.7,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as Error).message).toBe(MSG_NOT_FOUND);
    });

    it('multiplier < 1.0 -> AF-2, không gọi DB', async () => {
      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', RULE_ID_1, {
          multiplier: 0.8,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(seatModel.findOne).not.toHaveBeenCalled();
    });

    it('DB reject -> 500 MSG_SAVE_FAILED', async () => {
      seatModel.findOneAndUpdate.mockReturnValue(failing());
      const err = await service
        .updatePriceValue(PriceGroup.SEAT, 'VIP', RULE_ID_1, {
          multiplier: 1.8,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_SAVE_FAILED);
    });
  });

  describe('deletePriceValue', () => {
    beforeEach(() => {
      seatModel.findOne.mockReturnValue(chain(rule()));
      seatModel.findByIdAndDelete.mockReturnValue(chain({ _id: RULE_ID_1 }));
    });

    it('xóa vật lý đúng 1 lần, trả MSG_DELETE_SUCCESS với giá trị vừa xóa', async () => {
      const res = await service.deletePriceValue(
        PriceGroup.SEAT,
        'VIP',
        RULE_ID_1,
      );
      expect(seatModel.findByIdAndDelete).toHaveBeenCalledTimes(1);
      expect(seatModel.findByIdAndDelete).toHaveBeenCalledWith(RULE_ID_1);
      expect(res.message).toBe(MSG_DELETE_SUCCESS);
      expect(res.value.ruleId).toBe(RULE_ID_1);
      expect(res.field).toBe(FIELD);
    });

    it('xóa giá trị cuối cùng của trường -> được phép', async () => {
      optionQuery.getPriceField.mockResolvedValue({ ...FIELD, values: [] });
      const res = await service.deletePriceValue(
        PriceGroup.SEAT,
        'VIP',
        RULE_ID_1,
      );
      expect(res.field.values).toEqual([]);
    });

    it('ruleId không tồn tại / thuộc trường khác -> 404', async () => {
      seatModel.findOne.mockReturnValue(chain(null));
      const err = await service
        .deletePriceValue(PriceGroup.SEAT, 'VIP', '507f1f77bcf86cd799439099')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect(seatModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('xóa đồng thời (findByIdAndDelete null) -> 404', async () => {
      seatModel.findByIdAndDelete.mockReturnValue(chain(null));
      const err = await service
        .deletePriceValue(PriceGroup.SEAT, 'VIP', RULE_ID_1)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
    });

    it('DB reject -> 500 MSG_SAVE_FAILED', async () => {
      seatModel.findByIdAndDelete.mockReturnValue(failing());
      const err = await service
        .deletePriceValue(PriceGroup.SEAT, 'VIP', RULE_ID_1)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as Error).message).toBe(MSG_SAVE_FAILED);
    });
  });
});
