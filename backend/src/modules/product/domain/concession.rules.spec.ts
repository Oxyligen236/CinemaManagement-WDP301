import {
  CONCESSION_CONSTANTS,
  CONCESSION_MESSAGES,
  escapeRegex,
  parseExcelCategory,
  parseExcelSize,
  resolveItemStockStatus,
} from './concession.rules';
import { ItemCategory } from './enums/item-category.enum';
import { ItemSize } from './enums/item-size.enum';
import { ItemStatus } from './enums/item-status.enum';

describe('concession.rules', () => {
  it('exports concession constants and messages', () => {
    expect(CONCESSION_CONSTANTS.IMAGE_MAX_SIZE).toBe(5 * 1024 * 1024);
    expect(CONCESSION_CONSTANTS.DEFAULT_LOW_STOCK_THRESHOLD).toBe(10);
    expect(CONCESSION_MESSAGES.NO_BRANCH).toBeDefined();
    expect(CONCESSION_MESSAGES.ITEM_NOT_FOUND).toBeDefined();
  });

  describe('parseExcelCategory', () => {
    it('returns null for empty or nullish input', () => {
      expect(parseExcelCategory(undefined)).toBeNull();
      expect(parseExcelCategory(null)).toBeNull();
      expect(parseExcelCategory('')).toBeNull();
    });

    it('parses POPCORN variants case-insensitively with trimming', () => {
      expect(parseExcelCategory('POPCORN')).toBe(ItemCategory.POPCORN);
      expect(parseExcelCategory('  bắp  ')).toBe(ItemCategory.POPCORN);
      expect(parseExcelCategory('BẮP RANG')).toBe(ItemCategory.POPCORN);
      expect(parseExcelCategory('bap')).toBe(ItemCategory.POPCORN);
      expect(parseExcelCategory('bap rang')).toBe(ItemCategory.POPCORN);
    });

    it('parses BEVERAGE variants', () => {
      expect(parseExcelCategory('BEVERAGE')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('nước')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('NƯỚC UỐNG')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('nuoc')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('nuoc uong')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('đồ uống')).toBe(ItemCategory.BEVERAGE);
      expect(parseExcelCategory('do uong')).toBe(ItemCategory.BEVERAGE);
    });

    it('parses SNACK variants', () => {
      expect(parseExcelCategory('SNACK')).toBe(ItemCategory.SNACK);
      expect(parseExcelCategory('đồ ăn vặt')).toBe(ItemCategory.SNACK);
      expect(parseExcelCategory('do an vat')).toBe(ItemCategory.SNACK);
      expect(parseExcelCategory('bánh kẹo')).toBe(ItemCategory.SNACK);
      expect(parseExcelCategory('banh keo')).toBe(ItemCategory.SNACK);
    });

    it('parses OTHER variants', () => {
      expect(parseExcelCategory('OTHER')).toBe(ItemCategory.OTHER);
      expect(parseExcelCategory('khác')).toBe(ItemCategory.OTHER);
      expect(parseExcelCategory('khac')).toBe(ItemCategory.OTHER);
      expect(parseExcelCategory('phụ kiện')).toBe(ItemCategory.OTHER);
      expect(parseExcelCategory('phu kien')).toBe(ItemCategory.OTHER);
    });

    it('returns null for unknown category', () => {
      expect(parseExcelCategory('ELECTRONICS')).toBeNull();
    });
  });

  describe('parseExcelSize', () => {
    it('returns null for empty or nullish input', () => {
      expect(parseExcelSize(undefined)).toBeNull();
      expect(parseExcelSize(null)).toBeNull();
      expect(parseExcelSize('')).toBeNull();
    });

    it('parses STANDARD variants', () => {
      expect(parseExcelSize('STANDARD')).toBe(ItemSize.STANDARD);
      expect(parseExcelSize('tiêu chuẩn')).toBe(ItemSize.STANDARD);
      expect(parseExcelSize('tieu chuan')).toBe(ItemSize.STANDARD);
      expect(parseExcelSize(' s ')).toBe(ItemSize.STANDARD);
      expect(parseExcelSize('nhỏ')).toBe(ItemSize.STANDARD);
    });

    it('parses MEDIUM variants', () => {
      expect(parseExcelSize('MEDIUM')).toBe(ItemSize.MEDIUM);
      expect(parseExcelSize('vừa')).toBe(ItemSize.MEDIUM);
      expect(parseExcelSize('vua')).toBe(ItemSize.MEDIUM);
      expect(parseExcelSize('m')).toBe(ItemSize.MEDIUM);
    });

    it('parses LARGE variants', () => {
      expect(parseExcelSize('LARGE')).toBe(ItemSize.LARGE);
      expect(parseExcelSize('lớn')).toBe(ItemSize.LARGE);
      expect(parseExcelSize('lon')).toBe(ItemSize.LARGE);
      expect(parseExcelSize('l')).toBe(ItemSize.LARGE);
    });

    it('parses EXTRA_LARGE variants', () => {
      expect(parseExcelSize('EXTRA_LARGE')).toBe(ItemSize.EXTRA_LARGE);
      expect(parseExcelSize('xl')).toBe(ItemSize.EXTRA_LARGE);
      expect(parseExcelSize('đặc biệt')).toBe(ItemSize.EXTRA_LARGE);
      expect(parseExcelSize('dac biet')).toBe(ItemSize.EXTRA_LARGE);
      expect(parseExcelSize('cực lớn')).toBe(ItemSize.EXTRA_LARGE);
    });

    it('returns null for unknown size', () => {
      expect(parseExcelSize('XXL')).toBeNull();
    });
  });

  describe('resolveItemStockStatus', () => {
    it('keeps INACTIVE regardless of stock quantity', () => {
      expect(resolveItemStockStatus(50, ItemStatus.INACTIVE)).toBe(
        ItemStatus.INACTIVE,
      );
      expect(resolveItemStockStatus(0, ItemStatus.INACTIVE)).toBe(
        ItemStatus.INACTIVE,
      );
    });

    it('returns OUT_OF_STOCK when stock is zero or negative and not INACTIVE', () => {
      expect(resolveItemStockStatus(0, ItemStatus.AVAILABLE)).toBe(
        ItemStatus.OUT_OF_STOCK,
      );
      expect(resolveItemStockStatus(-3, ItemStatus.OUT_OF_STOCK)).toBe(
        ItemStatus.OUT_OF_STOCK,
      );
    });

    it('returns AVAILABLE when stock is positive and not INACTIVE', () => {
      expect(resolveItemStockStatus(5, ItemStatus.OUT_OF_STOCK)).toBe(
        ItemStatus.AVAILABLE,
      );
      expect(resolveItemStockStatus(1, ItemStatus.AVAILABLE)).toBe(
        ItemStatus.AVAILABLE,
      );
    });
  });

  describe('escapeRegex', () => {
    it('escapes all special regex characters', () => {
      expect(escapeRegex('a.b+c*(d)[e]{f}^$\\|?')).toBe(
        'a\\.b\\+c\\*\\(d\\)\\[e\\]\\{f\\}\\^\\$\\\\\\|\\?',
      );
    });

    it('leaves plain text unchanged', () => {
      expect(escapeRegex('Popcorn Large 123')).toBe('Popcorn Large 123');
    });
  });
});
