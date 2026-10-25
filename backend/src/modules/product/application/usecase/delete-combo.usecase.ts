import { DeleteMutationRes } from '../dto/res.dto';

/**
 * Usecase xóa gói Combo khỏi cơ sở dữ liệu chi nhánh.
 */
export interface DeleteComboUsecase {
  /**
   * Xóa một gói Combo thuộc chi nhánh của quản lý.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm combo theo `comboId` thuộc `branchId` của quản lý.
   * 3. Thực hiện xóa bản ghi combo trong cơ sở dữ liệu.
   * 4. Trả về kết quả `DeleteMutationRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param comboId - ID định danh duy nhất của Combo cần xóa
   * @returns Thông báo kết quả xóa và ID của combo đã xóa
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws NotFoundException khi không tìm thấy Combo tương ứng trong chi nhánh
   */
  deleteCombo(
    managerUserId: string,
    comboId: string,
  ): Promise<DeleteMutationRes>;
}
