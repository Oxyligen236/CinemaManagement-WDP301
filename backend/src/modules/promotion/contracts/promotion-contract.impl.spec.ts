import { PromotionContractImpl } from './promotion-contract.impl';
import { PromotionPublicService } from '../application/services/promotion-public.service';

describe('PromotionContractImpl', () => {
  let contract: PromotionContractImpl;
  let mockPromotionPublicService: {
    getPromotionById: jest.Mock;
    validatePromotionCode: jest.Mock;
    recordPromotionUsage: jest.Mock;
  };

  beforeEach(() => {
    mockPromotionPublicService = {
      getPromotionById: jest.fn(),
      validatePromotionCode: jest.fn(),
      recordPromotionUsage: jest.fn(),
    };
    contract = new PromotionContractImpl(
      mockPromotionPublicService as unknown as PromotionPublicService,
    );
  });

  it('lấy chi tiết khuyến mãi theo ID', async () => {
    mockPromotionPublicService.getPromotionById.mockResolvedValue({
      promotionId: 'pro-1',
      promotionCode: 'GIAM10',
      discountValue: 10,
      discountType: 'PERCENTAGE',
      isActive: true,
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await contract.getPromotionById('pro-1');
    expect(result?.promotionCode).toBe('GIAM10');
    expect(result?.discountValue).toBe(10);
  });

  it('trả về null khi không tìm thấy promotion', async () => {
    mockPromotionPublicService.getPromotionById.mockResolvedValue(null);
    const result = await contract.getPromotionById('not-found');
    expect(result).toBeNull();
  });

  it('validate mã khuyến mãi', async () => {
    mockPromotionPublicService.validatePromotionCode.mockResolvedValue({
      isValid: true,
      discountAmount: 10000,
      promotionCode: 'GIAM10',
    });

    const result = await contract.validatePromotionCode({
      code: 'GIAM10',
      orderAmount: 100000,
      userId: 'u-1',
    });
    expect(result.isValid).toBe(true);
    expect(result.discountAmount).toBe(10000);
  });

  it('ghi nhận sử dụng mã khuyến mãi', async () => {
    mockPromotionPublicService.recordPromotionUsage.mockResolvedValue(
      undefined,
    );

    await contract.recordPromotionUsage({
      promotionId: 'pro-1',
      userId: 'u-1',
      orderId: 'ord-1',
    });

    expect(
      mockPromotionPublicService.recordPromotionUsage,
    ).toHaveBeenCalledWith({
      promotionId: 'pro-1',
      userId: 'u-1',
      orderId: 'ord-1',
    });
  });
});
