import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PromotionAdminService } from './promotion-admin.service';
import { InternalEventBus } from '../../../infra/event/application/internal-event-bus.interface';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('PromotionAdminService', () => {
  let service: PromotionAdminService;
  let mockPrisma: any;
  let mockEventBus: jest.Mocked<InternalEventBus>;

  const samplePromotion = {
    id: 'test-uuid-1',
    promotionCode: 'SUMMER2026',
    discountValue: 20,
    discountType: DiscountType.PERCENTAGE,
    startDate: new Date('2026-11-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.000Z'),
    isActive: true,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      promotion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new PromotionAdminService(mockPrisma, mockEventBus);
  });

  describe('createPromotion', () => {
    it('should create promotion and publish event', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);
      mockPrisma.promotion.create.mockResolvedValue(samplePromotion);

      const dto = {
        promotionCode: 'summer2026',
        discountValue: 20,
        discountType: DiscountType.PERCENTAGE,
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
        isActive: true,
      };

      const result = await service.createPromotion(dto);

      expect(mockPrisma.promotion.findFirst).toHaveBeenCalledWith({
        where: { promotionCode: 'SUMMER2026' },
      });
      expect(mockPrisma.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          promotionCode: 'SUMMER2026',
          discountValue: 20,
          discountType: DiscountType.PERCENTAGE,
        }),
      });
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
      mockPrisma.promotion.findFirst.mockResolvedValue(samplePromotion);

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
      mockPrisma.promotion.findMany.mockResolvedValue([samplePromotion]);
      mockPrisma.promotion.count.mockResolvedValue(1);

      const result = await service.getPromotions({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getPromotionById', () => {
    it('should return promotion by id', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(samplePromotion);

      const result = await service.getPromotionById('test-uuid-1');

      expect(result.promotionId).toBe('test-uuid-1');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(null);

      await expect(service.getPromotionById('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePromotion', () => {
    it('should update and publish event', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(samplePromotion);
      mockPrisma.promotion.update.mockResolvedValue({
        ...samplePromotion,
        discountValue: 25,
      });

      const result = await service.updatePromotion('test-uuid-1', {
        discountValue: 25,
      });

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid-1' },
        data: { discountValue: 25 },
      });
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(result.discountValue).toBe(25);
    });
  });

  describe('changePromotionStatus', () => {
    it('should toggle status to false and publish event', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(samplePromotion);
      mockPrisma.promotion.update.mockResolvedValue({
        ...samplePromotion,
        isActive: false,
      });

      const result = await service.changePromotionStatus('test-uuid-1', false);

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid-1' },
        data: { isActive: false },
      });
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(result.isActive).toBe(false);
    });
  });
});
