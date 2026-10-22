import { UpdatePromotionDto } from '../dto/req.dto';
import { PromotionResponseDto } from '../dto/res.dto';

/**
 * Nghiệp vụ cập nhật thông tin chương trình khuyến mãi cho quản trị viên.
 */
export interface UpdatePromotionUsecase {
  /**
   * Cập nhật thông tin chi tiết của chương trình khuyến mãi.
   *
   * Quy trình nghiệp vụ:
   * 1. Kiểm tra sự tồn tại của chương trình khuyến mãi theo `promotionId`.
   * 2. Kiểm tra tính hợp lệ của thời gian mới nếu có cập nhật (ngày bắt đầu < ngày kết thúc).
   * 3. Kiểm tra tính hợp lệ của giá trị giảm giá mới nếu có cập nhật (phần trăm <= 100%).
   * 4. Cập nhật các trường thông tin thay đổi vào cơ sở dữ liệu.
   * 5. Phát sinh sự kiện PromotionUpdatedEvent qua event bus nội bộ.
   *
   * @param promotionId - Mã định danh duy nhất của chương trình khuyến mãi.
   * @param dto - Thông tin cần cập nhật (mức giảm, loại giảm, thời gian áp dụng, trạng thái).
   * @returns Thông tin chương trình khuyến mãi sau khi cập nhật.
   * @throws NotFoundException khi không tìm thấy khuyến mãi theo `promotionId`.
   * @throws BadRequestException khi thời gian hoặc mức giảm giá không hợp lệ.
   */
  updatePromotion(
    promotionId: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto>;
}
