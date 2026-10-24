import { QueryPromotionsDto } from '../dto/req.dto';
import { PromotionResponseDto } from '../dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

/**
 * Nghiệp vụ truy vấn và tra cứu danh sách chương trình khuyến mãi cho quản trị viên.
 */
export interface QueryPromotionUsecase {
  /**
   * Lấy danh sách chương trình khuyến mãi có phân trang, tìm kiếm và lọc theo tiêu chí.
   *
   * Quy trình nghiệp vụ:
   * 1. Lấy thông số phân trang `page` và `limit` từ `query`.
   * 2. Xây dựng bộ lọc tìm kiếm theo mã khuyến mãi (regex), loại giảm giá, trạng thái hoạt động.
   * 3. Thực hiện truy vấn danh sách bản ghi kèm đếm tổng số bản ghi thỏa mãn điều kiện.
   * 4. Đóng gói dữ liệu kết quả dưới dạng `Page<PromotionResponseDto>`.
   *
   * @param query - Tiêu chí truy vấn phân trang, tìm kiếm và sắp xếp (kế thừa PageRequest).
   * @returns Trang dữ liệu danh sách khuyến mãi kèm tổng số bản ghi và tổng số trang.
   */
  getPromotions(query: QueryPromotionsDto): Promise<Page<PromotionResponseDto>>;

  /**
   * Tra cứu chi tiết một chương trình khuyến mãi theo mã định danh.
   *
   * Quy trình nghiệp vụ:
   * 1. Tìm bản ghi khuyến mãi trong cơ sở dữ liệu theo `promotionId`.
   * 2. Kiểm tra nếu không tồn tại thì ném ngoại lệ NotFoundException.
   * 3. Chuyển đổi và trả về DTO chi tiết khuyến mãi.
   *
   * @param promotionId - Mã định danh duy nhất của chương trình khuyến mãi.
   * @returns Thông tin chi tiết của chương trình khuyến mãi.
   * @throws NotFoundException khi không tìm thấy khuyến mãi theo `promotionId`.
   */
  getPromotionById(promotionId: string): Promise<PromotionResponseDto>;
}
