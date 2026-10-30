import { PromotionPublicService } from './promotion-public.service';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('PromotionPublicService', () => {
  let service: PromotionPublicService;
  let mockPrisma: any;

  const defaultPromotion = {
    id: 'promo-1',
    promotionCode: 'DISCOUNT10',
    discountValue: 10,
    discountType: DiscountType.PERCENTAGE,
    isActive: true,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    minOrderValue: 50000,
    maxDiscountAmount: 50000,
    usageLimit: 100,
    usedCount: 5,
  };

  beforeEach(() => {
    mockPrisma = {
      promotion: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      promotionUsage: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new PromotionPublicService(mockPrisma as unknown as PrismaService);
  });

  describe('validatePromotionCode', () => {
    it('thẩm định mã thành công khi người dùng chưa từng sử dụng mã', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(defaultPromotion);
      mockPrisma.promotionUsage.findFirst.mockResolvedValue(null);

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(true);
      expect(result.promotionId).toBe('promo-1');
      expect(result.discountAmount).toBe(10000);
      expect(mockPrisma.promotionUsage.findFirst).toHaveBeenCalledWith({
        where: {
          promotionId: 'promo-1',
          userId: 'user-1',
        },
      });
    });

    it('thẩm định mã thất bại khi người dùng đã từng sử dụng mã', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(defaultPromotion);
      mockPrisma.promotionUsage.findFirst.mockResolvedValue({ id: 'usage-1' });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.reason).toBe('Bạn đã sử dụng mã giảm giá này rồi');
    });

    it('thẩm định mã thất bại khi không tìm thấy mã', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);

      const result = await service.validatePromotionCode({
        code: 'NOTEXIST',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.reason).toBe('Mã giảm giá không tồn tại');
    });

    it('thẩm định mã thất bại khi mã chưa kích hoạt', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue({
        ...defaultPromotion,
        isActive: false,
      });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.reason).toBe('Mã giảm giá hiện đang tạm ngừng hoạt động');
    });

    it('thẩm định mã thất bại khi đơn hàng chưa đạt giá trị tối thiểu', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(defaultPromotion);

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 30000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.reason).toBe(
        'Giá trị đơn hàng chưa đạt mức tối thiểu 50000',
      );
    });

    it('thẩm định mã thất bại khi đã hết lượt sử dụng tổng thể', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue({
        ...defaultPromotion,
        usageLimit: 10,
        usedCount: 10,
      });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.discountAmount).toBe(0);
      expect(result.reason).toBe('Mã giảm giá đã hết lượt sử dụng');
    });
  });

  describe('recordPromotionUsage', () => {
    it('tạo bản ghi lịch sử sử dụng và tăng usedCount', async () => {
      mockPrisma.promotionUsage.create.mockResolvedValue({ id: 'usage-1' });
      mockPrisma.promotion.update.mockResolvedValue({ id: 'promo-1' });

      await service.recordPromotionUsage({
        promotionId: 'promo-1',
        userId: 'user-1',
        orderId: 'order-1',
      });

      expect(mockPrisma.promotionUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      });

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('idempotent: bỏ qua lỗi khi bản ghi đã tồn tại', async () => {
      mockPrisma.promotionUsage.create.mockRejectedValue(new Error('Duplicate key'));

      await expect(
        service.recordPromotionUsage({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
