import { CreatePromotionDto } from '../dto/req.dto';
import { PromotionResponseDto } from '../dto/res.dto';

/**
 * Nghiệp vụ tạo chương trình khuyến mãi mới cho quản trị viên.
 */
export interface CreatePromotionUsecase {
  /**
   * Tạo chương trình khuyến mãi mới trong hệ thống.
   *
   * Quy trình nghiệp vụ:
   * 1. Chuẩn hóa mã khuyến mãi (viết hoa, cắt khoảng trắng).
   * 2. Kiểm tra tính hợp lệ của thời gian (ngày bắt đầu < ngày kết thúc, ngày kết thúc không ở quá khứ).
   * 3. Kiểm tra tính hợp lệ của giá trị giảm giá (discountValue > 0, nếu phần trăm thì <= 100%).
   * 4. Kiểm tra trùng lặp mã khuyến mãi trong hệ thống.
   * 5. Tạo mới bản ghi khuyến mãi vào cơ sở dữ liệu.
   * 6. Phát sinh sự kiện PromotionCreatedEvent qua event bus nội bộ.
   *
   * @param dto - Dữ liệu yêu cầu tạo khuyến mãi (mã, mức giảm, loại giảm, thời gian, trạng thái).
   * @returns Thông tin chương trình khuyến mãi vừa được tạo.
   * @throws BadRequestException khi ngày bắt đầu >= ngày kết thúc hoặc ngày kết thúc trong quá khứ hoặc mức giảm không hợp lệ.
   * @throws ConflictException khi mã khuyến mãi đã tồn tại trong hệ thống.
   */
  createPromotion(dto: CreatePromotionDto): Promise<PromotionResponseDto>;
}
