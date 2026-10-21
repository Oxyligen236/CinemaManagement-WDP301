import { DiscountType } from '../../domain/enums/discount-type.enum';
import { PromotionResponseDto } from './res.dto';

describe('PromotionResponseDto', () => {
  const rawData = {
    promotionId: 'promo-123',
    promotionCode: 'SUMMER2026',
    discountValue: 20,
    discountType: DiscountType.PERCENTAGE,
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T23:59:59.000Z'),
    isActive: true,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
  };

  describe('of()', () => {
    it('should map from a plain object', () => {
      const res = PromotionResponseDto.of(rawData);

      expect(res).toBeInstanceOf(PromotionResponseDto);
      expect(res.promotionId).toBe('promo-123');
      expect(res.promotionCode).toBe('SUMMER2026');
      expect(res.discountValue).toBe(20);
      expect(res.discountType).toBe(DiscountType.PERCENTAGE);
      expect(res.startDate).toEqual(new Date('2026-06-01T00:00:00.000Z'));
      expect(res.endDate).toEqual(new Date('2026-08-31T23:59:59.000Z'));
      expect(res.isActive).toBe(true);
      expect(res.createdAt).toEqual(new Date('2026-05-01T10:00:00.000Z'));
      expect(res.updatedAt).toEqual(new Date('2026-05-02T10:00:00.000Z'));
    });

    it('should map from an object with _doc (Mongoose document simulation)', () => {
      const doc = { _doc: rawData };
      const res = PromotionResponseDto.of(doc);

      expect(res).toBeInstanceOf(PromotionResponseDto);
      expect(res.promotionId).toBe('promo-123');
      expect(res.promotionCode).toBe('SUMMER2026');
      expect(res.discountValue).toBe(20);
      expect(res.discountType).toBe(DiscountType.PERCENTAGE);
      expect(res.isActive).toBe(true);
    });
  });

  describe('ofArray()', () => {
    it('should return empty array when input is empty or null/undefined', () => {
      expect(PromotionResponseDto.ofArray([])).toEqual([]);
      expect(PromotionResponseDto.ofArray(null as any)).toEqual([]);
      expect(PromotionResponseDto.ofArray(undefined as any)).toEqual([]);
    });

    it('should map multiple items correctly', () => {
      const list = [
        rawData,
        { ...rawData, promotionId: 'promo-456', promotionCode: 'WINTER2026' },
      ];
      const resList = PromotionResponseDto.ofArray(list);

      expect(resList).toHaveLength(2);
      expect(resList[0]).toBeInstanceOf(PromotionResponseDto);
      expect(resList[1]).toBeInstanceOf(PromotionResponseDto);
      expect(resList[0].promotionId).toBe('promo-123');
      expect(resList[1].promotionId).toBe('promo-456');
      expect(resList[1].promotionCode).toBe('WINTER2026');
    });
  });
});
