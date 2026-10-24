import { PromotionResponseDto } from '../dto/res.dto';

/**
 * Nghiệp vụ tra cứu công khai thông tin khuyến mãi cho khách hàng.
 */
export interface GetPublicPromotionUsecase {
  /**
   * Tra cứu công khai thông tin chi tiết khuyến mãi theo ID.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm bản ghi khuyến mãi trong cơ sở dữ liệu theo `promotionId`.
   * 2. Trả về thông tin khuyến mãi nếu tìm thấy hoặc null nếu không tồn tại.
   *
   * @param promotionId - Mã định danh duy nhất của chương trình khuyến mãi.
   * @returns DTO thông tin khuyến mãi hoặc null khi không tìm thấy.
   */
  getPromotionById(promotionId: string): Promise<PromotionResponseDto | null>;
}
