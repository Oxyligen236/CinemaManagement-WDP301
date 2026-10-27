import { PromotionPublicService } from './promotion-public.service';
import { DiscountType } from '../../domain/enums/discount-type.enum';

describe('PromotionPublicService', () => {
  let service: PromotionPublicService;
  let mockPromotionModel: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };
  let mockPromotionUsageModel: {
    exists: jest.Mock;
    create: jest.Mock;
  };

  const defaultPromotion = {
    promotionId: 'promo-1',
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
    mockPromotionModel = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };
    mockPromotionUsageModel = {
      exists: jest.fn(),
      create: jest.fn(),
    };

    service = new PromotionPublicService(
      mockPromotionModel as unknown as never,
      mockPromotionUsageModel as unknown as never,
    );
  });

  describe('validatePromotionCode', () => {
    it('thẩm định mã thành công khi người dùng chưa từng sử dụng mã', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(defaultPromotion),
      });
      mockPromotionUsageModel.exists.mockResolvedValue(null);

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(true);
      expect(result.promotionId).toBe('promo-1');
      expect(result.discountAmount).toBe(10000);
      expect(mockPromotionUsageModel.exists).toHaveBeenCalledWith({
        promotionId: 'promo-1',
        userId: 'user-1',
      });
    });

    it('thẩm định mã thất bại khi người dùng đã từng sử dụng mã', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(defaultPromotion),
      });
      mockPromotionUsageModel.exists.mockResolvedValue({ _id: 'some-id' });

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
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.validatePromotionCode({
        code: 'NOT_FOUND',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Mã giảm giá không tồn tại');
    });

    it('thẩm định mã thất bại khi mã chưa kích hoạt', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...defaultPromotion,
          isActive: false,
        }),
      });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Mã giảm giá hiện đang tạm ngừng hoạt động');
    });

    it('thẩm định mã thất bại khi đơn hàng chưa đạt giá trị tối thiểu', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(defaultPromotion),
      });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 30000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('chưa đạt mức tối thiểu');
    });

    it('thẩm định mã thất bại khi đã hết lượt sử dụng tổng thể', async () => {
      mockPromotionModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...defaultPromotion,
          usedCount: 100,
          usageLimit: 100,
        }),
      });

      const result = await service.validatePromotionCode({
        code: 'DISCOUNT10',
        orderAmount: 100000,
        userId: 'user-1',
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Mã giảm giá đã hết lượt sử dụng');
    });
  });

  describe('recordPromotionUsage', () => {
    it('tạo bản ghi lịch sử sử dụng và tăng usedCount', async () => {
      mockPromotionUsageModel.create.mockResolvedValue({});
      mockPromotionModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.recordPromotionUsage({
        promotionId: 'promo-1',
        userId: 'user-1',
        orderId: 'order-1',
      });

      expect(mockPromotionUsageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      );
      expect(mockPromotionModel.updateOne).toHaveBeenCalledWith(
        { promotionId: 'promo-1' },
        { $inc: { usedCount: 1 } },
      );
    });

    it('bỏ qua lỗi duplicate key 11000 để đảm bảo tính idempotency', async () => {
      const duplicateError = Object.assign(new Error('Duplicate key'), {
        code: 11000,
      });
      mockPromotionUsageModel.create.mockRejectedValue(duplicateError);

      await expect(
        service.recordPromotionUsage({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      ).resolves.toBeUndefined();
    });

    it('ném lỗi khác nếu xảy ra sự cố cơ sở dữ liệu', async () => {
      const dbError = new Error('Database connection failed');
      mockPromotionUsageModel.create.mockRejectedValue(dbError);

      await expect(
        service.recordPromotionUsage({
          promotionId: 'promo-1',
          userId: 'user-1',
          orderId: 'order-1',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
