import { PromotionResponseDto } from '../dto/res.dto';

/**
 * Nghiệp vụ kích hoạt hoặc vô hiệu hóa chương trình khuyến mãi cho quản trị viên.
 */
export interface ChangePromotionStatusUsecase {
  /**
   * Thay đổi trạng thái hoạt động (kích hoạt / tạm dừng) của chương trình khuyến mãi.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra sự tồn tại của khuyến mãi theo `promotionId` và cập nhật trường `isActive`.
   * 2. Lưu trạng thái mới vào cơ sở dữ liệu.
   * 3. Phát sinh sự kiện PromotionStatusChangedEvent qua event bus nội bộ.
   *
   * @param promotionId - Mã định danh duy nhất của chương trình khuyến mãi.
   * @param isActive - Trạng thái hoạt động mới (true: kích hoạt, false: hủy kích hoạt).
   * @returns Thông tin chương trình khuyến mãi sau khi đổi trạng thái.
   * @throws NotFoundException khi không tìm thấy khuyến mãi theo `promotionId`.
   */
  changePromotionStatus(
    promotionId: string,
    isActive: boolean,
  ): Promise<PromotionResponseDto>;
}
