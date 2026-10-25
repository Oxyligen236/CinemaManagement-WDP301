import { ComboRes } from '../dto/res.dto';

/**
 * Usecase lấy chi tiết thông tin một gói Combo theo mã comboId, kèm phân tích tồn kho từng món thành phần.
 */
export interface GetComboDetailUsecase {
  /**
   * Lấy chi tiết gói Combo và trạng thái sẵn sàng của các món thành phần.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm combo theo `comboId` thuộc `branchId` của quản lý.
   * 3. Lấy thông tin chi tiết từng món con từ collection `items`.
   * 4. Tính toán chi tiết tồn kho ảo `availableStock`, cờ `isAvailable`, `originalTotalPrice`, `savingsAmount`.
   * 5. Trả về đối tượng `ComboRes` đầy đủ.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param comboId - ID định danh duy nhất của Combo cần xem chi tiết
   * @returns Chi tiết gói Combo
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws NotFoundException khi không tìm thấy Combo tương ứng trong chi nhánh
   */
  getComboDetail(managerUserId: string, comboId: string): Promise<ComboRes>;
}
