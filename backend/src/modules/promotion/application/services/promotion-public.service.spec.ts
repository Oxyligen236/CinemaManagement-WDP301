import { PromotionPublicService } from './promotion-public.service';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';

describe('PromotionPublicService', () => {
  let service: PromotionPublicService;
  let mockPrisma: {
    promotion: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    promotionUsage: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

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

    service = new PromotionPublicService(
      mockPrisma as unknown as PrismaService,
    );
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

    it('thẩm định mã thất bại khi mã rỗng/khoảng trắng', async () => {
      const result = await service.validatePromotionCode({
        code: '   ',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Mã giảm giá không được để trống');
      expect(mockPrisma.promotion.findFirst).not.toHaveBeenCalled();
    });

    it('thẩm định mã thất bại khi chưa đến ngày áp dụng hoặc đã hết hạn', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValueOnce({
        ...defaultPromotion,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 172800000),
      });
      const early = await service.validatePromotionCode({
        code: 'EARLY',
        orderAmount: 100000,
        userId: 'user-1',
      });
      expect(early.isValid).toBe(false);
      expect(early.reason).toBe('Mã giảm giá chưa đến ngày áp dụng');

      mockPrisma.promotion.findFirst.mockResolvedValueOnce({
        ...defaultPromotion,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-02-01'),
      });
      const expired = await service.validatePromotionCode({
        code: 'EXPIRED',
        orderAmount: 100000,
        userId: 'user-1',
      });
      expect(expired.isValid).toBe(false);
      expect(expired.reason).toBe('Mã giảm giá đã hết hạn sử dụng');
    });

    it('tính giảm giá cho loại FIXED, không check usage khi thiếu userId, và tôn trọng maxDiscountAmount', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValueOnce({
        ...defaultPromotion,
        discountType: DiscountType.FIXED,
        discountValue: 150000,
        minOrderValue: null,
        usageLimit: null,
        usedCount: undefined,
      });

      const fixedRes = await service.validatePromotionCode({
        code: 'FIXED150',
        orderAmount: 80000,
        userId: '',
      });

      expect(fixedRes.isValid).toBe(true);
      expect(fixedRes.discountAmount).toBe(80000);
      expect(mockPrisma.promotionUsage.findFirst).not.toHaveBeenCalled();

      mockPrisma.promotion.findFirst.mockResolvedValueOnce({
        ...defaultPromotion,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 50,
        maxDiscountAmount: 25000,
        usedCount: undefined,
        usageLimit: 10,
      });
      mockPrisma.promotionUsage.findFirst.mockResolvedValue(null);

      const cappedRes = await service.validatePromotionCode({
        code: 'CAP25',
        orderAmount: 100000,
        userId: 'user-1',
      });
      expect(cappedRes.isValid).toBe(true);
      expect(cappedRes.discountAmount).toBe(25000);
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
        }) as unknown,
      });

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('idempotent: bỏ qua lỗi khi bản ghi đã tồn tại', async () => {
      mockPrisma.promotionUsage.create.mockRejectedValue(
        new Error('Duplicate key'),
      );

      await expect(
        service.recordPromotionUsage({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getPromotionById', () => {
    it('lấy chi tiết khuyến mãi theo ID', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-01-02T00:00:00.000Z');
      mockPrisma.promotion.findUnique.mockResolvedValue({
        ...defaultPromotion,
        createdAt,
        updatedAt,
      });

      const result = await service.getPromotionById('promo-1');

      expect(mockPrisma.promotion.findUnique).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
      });
      expect(result).toEqual({
        promotionId: 'promo-1',
        promotionCode: 'DISCOUNT10',
        discountValue: 10,
        discountType: DiscountType.PERCENTAGE,
        startDate: defaultPromotion.startDate,
        endDate: defaultPromotion.endDate,
        isActive: true,
        createdAt,
        updatedAt,
      });
    });

    it('trả về null khi không tìm thấy promotion', async () => {
      mockPrisma.promotion.findUnique.mockResolvedValue(null);

      const result = await service.getPromotionById('not-found');

      expect(mockPrisma.promotion.findUnique).toHaveBeenCalledWith({
        where: { id: 'not-found' },
      });
      expect(result).toBeNull();
    });
  });
});
