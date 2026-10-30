import { ItemCategory } from './enums/item-category.enum';
import { ItemSize } from './enums/item-size.enum';
import { ItemStatus } from './enums/item-status.enum';

export const CONCESSION_MESSAGES = {
  NO_BRANCH: 'Tài khoản quản lý chưa được gán vào chi nhánh hoạt động nào.',
  ITEM_NOT_FOUND: 'Không tìm thấy sản phẩm yêu cầu trong chi nhánh của bạn.',
  COMBO_NOT_FOUND: 'Không tìm thấy combo yêu cầu trong chi nhánh của bạn.',
  DUPLICATE_ITEM_NAME: 'Tên sản phẩm đã tồn tại trong chi nhánh này.',
  DUPLICATE_COMBO_NAME: 'Tên combo đã tồn tại trong chi nhánh này.',
  INVALID_STOCK_ADJUSTMENT: 'Số lượng điều chỉnh kho không hợp lệ.',
  STOCK_CANNOT_BE_NEGATIVE: 'Tồn kho không thể nhỏ hơn 0 sau khi điều chỉnh.',
  COMBO_ITEMS_EMPTY: 'Combo phải có ít nhất một món sản phẩm thành phần.',
  COMBO_ITEM_NOT_FOUND:
    'Một hoặc nhiều sản phẩm thành phần không tồn tại trong chi nhánh.',
  COMBO_PRICE_HIGHER_THAN_SUM:
    'Giá bán combo không nên cao hơn tổng giá bán lẻ của các món thành phần.',
  EXCEL_FILE_REQUIRED: 'Vui lòng chọn file Excel để tải lên.',
  INVALID_EXCEL_FORMAT: 'Định dạng file Excel không hợp lệ.',
  EMPTY_EXCEL_SHEET: 'Trang tính Excel không chứa dữ liệu hợp lệ.',
  EXCEL_EMPTY_FILE: 'File Excel không có dữ liệu hoặc không đúng định dạng.',
  EXCEL_INVALID_HEADER:
    'Cấu trúc tiêu đề cột file Excel không hợp lệ. Vui lòng tải file mẫu.',
  IMAGE_FILE_REQUIRED: 'Vui lòng chọn file hình ảnh sản phẩm.',
  IMAGE_INVALID_TYPE:
    'Định dạng hình ảnh không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP.',
  IMAGE_SIZE_EXCEEDED: 'Dung lượng file hình ảnh vượt quá giới hạn tối đa 5MB.',
  UPLOAD_IMAGE_SUCCESS: 'Tải hình ảnh sản phẩm lên hệ thống thành công.',
  CREATE_ITEM_SUCCESS: 'Tạo sản phẩm mới thành công.',
  UPDATE_ITEM_SUCCESS: 'Cập nhật sản phẩm thành công.',
  STOCK_UPDATE_SUCCESS: 'Điều chỉnh tồn kho sản phẩm thành công.',
  STATUS_UPDATE_SUCCESS: 'Cập nhật trạng thái sản phẩm thành công.',
  IMPORT_EXCEL_SUCCESS: 'Import dữ liệu sản phẩm từ file Excel thành công.',
  CREATE_COMBO_SUCCESS: 'Tạo gói combo mới thành công.',
  UPDATE_COMBO_SUCCESS: 'Cập nhật combo thành công.',
  DELETE_SUCCESS: 'Xóa thành công.',
  SERVICE_UNAVAILABLE:
    'Dịch vụ cơ sở dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.',
};

export const CONCESSION_CONSTANTS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  IMAGE_STORAGE_PREFIX: 'concessions',
  DEFAULT_LOW_STOCK_THRESHOLD: 10,
  EXCEL_MAX_FILE_SIZE: 5 * 1024 * 1024,
};

export const parseExcelCategory = (
  input?: string | null,
): ItemCategory | null => {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (['POPCORN', 'BẮP', 'BẮP RANG', 'BAP', 'BAP RANG'].includes(normalized)) {
    return ItemCategory.POPCORN;
  }
  if (
    [
      'BEVERAGE',
      'NƯỚC',
      'NƯỚC UỐNG',
      'NUOC',
      'NUOC UONG',
      'ĐỒ UỐNG',
      'DO UONG',
    ].includes(normalized)
  ) {
    return ItemCategory.BEVERAGE;
  }
  if (
    ['SNACK', 'ĐỒ ĂN VẶT', 'DO AN VAT', 'BÁNH KẸO', 'BANH KEO'].includes(
      normalized,
    )
  ) {
    return ItemCategory.SNACK;
  }
  if (['OTHER', 'KHÁC', 'KHAC', 'PHỤ KIỆN', 'PHU KIEN'].includes(normalized)) {
    return ItemCategory.OTHER;
  }
  return null;
};

export const parseExcelSize = (input?: string | null): ItemSize | null => {
  if (!input) return null;
  const normalized = input.trim().toUpperCase();
  if (
    ['STANDARD', 'TIÊU CHUẨN', 'TIEU CHUAN', 'S', 'NHỎ'].includes(normalized)
  ) {
    return ItemSize.STANDARD;
  }
  if (['MEDIUM', 'VỪA', 'VUA', 'M'].includes(normalized)) {
    return ItemSize.MEDIUM;
  }
  if (['LARGE', 'LỚN', 'LON', 'L'].includes(normalized)) {
    return ItemSize.LARGE;
  }
  if (
    ['EXTRA_LARGE', 'XL', 'ĐẶC BIỆT', 'DAC BIET', 'CỰC LỚN'].includes(
      normalized,
    )
  ) {
    return ItemSize.EXTRA_LARGE;
  }
  return null;
};

export const resolveItemStockStatus = (
  stockQuantity: number,
  currentStatus: ItemStatus,
): ItemStatus => {
  if (currentStatus === ItemStatus.INACTIVE) {
    return ItemStatus.INACTIVE;
  }
  if (stockQuantity <= 0) {
    return ItemStatus.OUT_OF_STOCK;
  }
  return ItemStatus.AVAILABLE;
};

export const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
