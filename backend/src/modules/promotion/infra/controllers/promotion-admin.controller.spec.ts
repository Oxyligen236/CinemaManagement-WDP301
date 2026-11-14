import { Test, TestingModule } from '@nestjs/testing';
import { DiscountType } from '../../domain/enums/discount-type.enum';
import { JwtGuard } from '../../../auth/infra/guards/jwt.guard';
import { RoleGuard } from '../../../auth/infra/guards/role.guard';
import { PromotionAdminService } from '../../application/services/promotion-admin.service';
import { PromotionAdminController } from './promotion-admin.controller';

describe('PromotionAdminController', () => {
  let controller: PromotionAdminController;
  let service: jest.Mocked<PromotionAdminService>;

  beforeEach(async () => {
    service = {
      createPromotion: jest.fn(),
      getPromotions: jest.fn(),
      getPromotionById: jest.fn(),
      updatePromotion: jest.fn(),
      changePromotionStatus: jest.fn(),
    } as unknown as jest.Mocked<PromotionAdminService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionAdminController],
      providers: [{ provide: PromotionAdminService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PromotionAdminController);
  });

  it('delegates createPromotion', async () => {
    const dto = {
      promotionCode: 'SALE10',
      discountValue: 10,
      discountType: DiscountType.PERCENTAGE,
      startDate: '2030-01-01T00:00:00Z',
      endDate: '2030-02-01T00:00:00Z',
    };
    const created = { promotionId: 'p-1', promotionCode: 'SALE10' };
    service.createPromotion.mockResolvedValue(created as any);

    await expect(controller.createPromotion(dto)).resolves.toEqual(created);
    expect(service.createPromotion).toHaveBeenCalledWith(dto);
  });

  it('delegates getPromotions', async () => {
    const query = { page: 1, limit: 10 };
    const page = { items: [], total: 0, page: 1, limit: 10 };
    service.getPromotions.mockResolvedValue(page as any);

    await expect(controller.getPromotions(query)).resolves.toEqual(page);
    expect(service.getPromotions).toHaveBeenCalledWith(query);
  });

  it('delegates getPromotionById', async () => {
    const promo = { promotionId: 'p-1' };
    service.getPromotionById.mockResolvedValue(promo as any);

    await expect(controller.getPromotionById('p-1')).resolves.toEqual(promo);
    expect(service.getPromotionById).toHaveBeenCalledWith('p-1');
  });

  it('delegates updatePromotion', async () => {
    const dto = { discountValue: 20 };
    const updated = { promotionId: 'p-1', discountValue: 20 };
    service.updatePromotion.mockResolvedValue(updated as any);

    await expect(controller.updatePromotion('p-1', dto)).resolves.toEqual(
      updated,
    );
    expect(service.updatePromotion).toHaveBeenCalledWith('p-1', dto);
  });

  it('delegates changePromotionStatus', async () => {
    const updated = { promotionId: 'p-1', isActive: false };
    service.changePromotionStatus.mockResolvedValue(updated as any);

    await expect(
      controller.changePromotionStatus('p-1', { isActive: false }),
    ).resolves.toEqual(updated);
    expect(service.changePromotionStatus).toHaveBeenCalledWith('p-1', false);
  });
});
