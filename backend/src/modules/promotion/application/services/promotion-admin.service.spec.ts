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

    it('should throw BadRequestException if endDate is in the past', async () => {
      await expect(
        service.createPromotion({
          promotionCode: 'OLD',
          discountValue: 10,
          discountType: DiscountType.PERCENTAGE,
          startDate: '2020-01-01T00:00:00.000Z',
          endDate: '2020-02-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(new BadRequestException('End date cannot be in the past'));
    });

    it('should throw BadRequestException if discountValue <= 0 or percentage > 100', async () => {
      await expect(
        service.createPromotion({
          promotionCode: 'ZERO',
          discountValue: 0,
          discountType: DiscountType.FIXED,
          startDate: '2030-01-01T00:00:00.000Z',
          endDate: '2030-02-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('Discount value must be greater than 0'),
      );

      await expect(
        service.createPromotion({
          promotionCode: 'OVER',
          discountValue: 101,
          discountType: DiscountType.PERCENTAGE,
          startDate: '2030-01-01T00:00:00.000Z',
          endDate: '2030-02-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('Percentage discount cannot exceed 100%'),
      );
    });

    it('should default isActive to true when omitted', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);
      mockPrisma.promotion.create.mockResolvedValue(samplePromotion);

      await service.createPromotion({
        promotionCode: 'DEFAULTACTIVE',
        discountValue: 50000,
        discountType: DiscountType.FIXED,
        startDate: '2030-01-01T00:00:00.000Z',
        endDate: '2030-02-01T00:00:00.000Z',
      });

      expect(mockPrisma.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: true }),
      });
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

    it('should apply search, discountType, isActive, sortOrder asc and fallback pagination', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);
      mockPrisma.promotion.count.mockResolvedValue(0);

      await service.getPromotions({
        page: 0,
        limit: 0,
        search: ' summer ',
        discountType: DiscountType.PERCENTAGE as any,
        isActive: false,
        sortBy: 'promotionCode',
        sortOrder: 'asc',
      });

      expect(mockPrisma.promotion.findMany).toHaveBeenCalledWith({
        where: {
          promotionCode: { contains: 'summer', mode: 'insensitive' },
          discountType: DiscountType.PERCENTAGE,
          isActive: false,
        },
        orderBy: { promotionCode: 'asc' },
        skip: 0,
        take: 10,
      });
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

    it('should throw NotFoundException when promotion does not exist', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePromotion('missing', { discountValue: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate dates, discountValue and percentage cap on update', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(samplePromotion);

      await expect(
        service.updatePromotion('test-uuid-1', {
          startDate: '2030-05-01T00:00:00.000Z',
          endDate: '2030-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(
        new BadRequestException('Start date must be before end date'),
      );

      await expect(
        service.updatePromotion('test-uuid-1', { discountValue: 0 }),
      ).rejects.toThrow(
        new BadRequestException('Discount value must be greater than 0'),
      );

      await expect(
        service.updatePromotion('test-uuid-1', {
          discountType: DiscountType.PERCENTAGE as any,
          discountValue: 120,
        }),
      ).rejects.toThrow(
        new BadRequestException('Percentage discount cannot exceed 100%'),
      );
    });

    it('should update discountType, startDate, endDate, and isActive when provided', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(samplePromotion);
      mockPrisma.promotion.update.mockResolvedValue({
        ...samplePromotion,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 30000,
        isActive: false,
      });

      await service.updatePromotion('test-uuid-1', {
        discountType: DiscountType.FIXED_AMOUNT as any,
        discountValue: 30000,
        startDate: '2030-01-01T00:00:00.000Z',
        endDate: '2030-02-01T00:00:00.000Z',
        isActive: false,
      });

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid-1' },
        data: {
          discountType: DiscountType.FIXED_AMOUNT,
          discountValue: 30000,
          startDate: new Date('2030-01-01T00:00:00.000Z'),
          endDate: new Date('2030-02-01T00:00:00.000Z'),
          isActive: false,
        },
      });
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

    it('should throw NotFoundException if promotion does not exist', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.changePromotionStatus('missing', true),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
