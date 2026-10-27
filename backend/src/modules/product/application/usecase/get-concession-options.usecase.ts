import { ConcessionOptionsRes } from '../dto/res.dto';

/**
 * Usecase lấy metadata tùy chọn và danh mục cho module Concession (F&B) tại chi nhánh của quản lý.
 */
export interface GetConcessionOptionsUsecase {
  /**
   * Lấy danh mục, kích cỡ, trạng thái và danh sách sản phẩm lẻ khả dụng để hỗ trợ tạo Combo.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Lấy thông tin chi nhánh của quản lý.
   * 3. Trả về enum danh mục, kích cỡ, trạng thái item và combo.
   * 4. Truy vấn danh sách các Item đang hoạt động trong chi nhánh để làm dữ liệu chọn khi tạo gói Combo.
   * 5. Trả về `ConcessionOptionsRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @returns Danh sách metadata tùy chọn và các item khả dụng `ConcessionOptionsRes`
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  getConcessionOptions(managerUserId: string): Promise<ConcessionOptionsRes>;
}
