/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PromotionAdminService } from './promotion-admin.service';
import {
  INTERNAL_EVENT_BUS,
  InternalEventBus,
} from '../../../infra/event/application/internal-event-bus.interface';
import { DiscountType } from '../../domain/enums/discount-type.enum';
import { Promotion } from '../../domain/schemas/promotion.schema';

describe('PromotionAdminService', () => {
  let service: PromotionAdminService;
  let mockPromotionModel: any;
  let mockEventBus: jest.Mocked<InternalEventBus>;

  const samplePromotionId = '507f1f77bcf86cd799439011';
  const samplePromotion = {
    _id: samplePromotionId,
    promotionCode: 'SUMMER2026',
    discountValue: 20,
    discountType: DiscountType.PERCENTAGE,
    startDate: new Date('2026-11-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    isActive: true,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    mockPromotionModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionAdminService,
        {
          provide: getModelToken(Promotion.name),
          useValue: mockPromotionModel,
        },
        {
          provide: INTERNAL_EVENT_BUS,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<PromotionAdminService>(PromotionAdminService);
  });

  describe('createPromotion', () => {
    it('should create promotion successfully and publish event', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockPromotionModel.create.mockResolvedValue(samplePromotion);

      const dto = {
        promotionCode: 'summer2026',
        discountValue: 20,
        discountType: DiscountType.PERCENTAGE,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
      };

      const result = await service.createPromotion(dto);

      expect(mockPromotionModel.findOne).toHaveBeenCalledWith({
        promotionCode: 'SUMMER2026',
      });
      expect(mockPromotionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          promotionCode: 'SUMMER2026',
          discountValue: 20,
          discountType: DiscountType.PERCENTAGE,
        }),
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(result.promotionCode).toBe('SUMMER2026');
    });

    it('should throw BadRequestException if startDate >= endDate', async () => {
      const dto = {
        promotionCode: 'INVALIDDATE',
        discountValue: 10,
        discountType: DiscountType.PERCENTAGE,
        startDate: '2026-12-31T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      };

      await expect(service.createPromotion(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if promotionCode already exists', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(samplePromotion),
      });

      const dto = {
        promotionCode: 'SUMMER2026',
        discountValue: 20,
        discountType: DiscountType.PERCENTAGE,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
      };

      await expect(service.createPromotion(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getPromotions', () => {
    it('should return paginated promotions', async () => {
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([samplePromotion]),
      };
      mockPromotionModel.find.mockReturnValue(mockQueryChain);
      mockPromotionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.getPromotions({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getPromotionById', () => {
    it('should return promotion by id', async () => {
      mockPromotionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(samplePromotion),
      });

      const result = await service.getPromotionById(samplePromotionId);

      expect(result.promotionId).toBe(samplePromotionId);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPromotionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getPromotionById('507f1f77bcf86cd799439099'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePromotion', () => {
    it('should update and publish event', async () => {
      mockPromotionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(samplePromotion),
      });
      mockPromotionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...samplePromotion,
          discountValue: 25,
        }),
      });

      const result = await service.updatePromotion(samplePromotionId, {
        discountValue: 25,
      });

      expect(mockPromotionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        samplePromotionId,
        { $set: { discountValue: 25 } },
        { new: true },
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(result.discountValue).toBe(25);
    });
  });

  describe('changePromotionStatus', () => {
    it('should toggle status to false and publish event', async () => {
      mockPromotionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...samplePromotion,
          isActive: false,
        }),
      });

      const result = await service.changePromotionStatus(
        samplePromotionId,
        false,
      );

      expect(mockPromotionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        samplePromotionId,
        { $set: { isActive: false } },
        { new: true },
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(result.isActive).toBe(false);
    });
  });
});
