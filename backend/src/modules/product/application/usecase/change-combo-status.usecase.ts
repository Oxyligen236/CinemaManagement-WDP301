import { ChangeComboStatusReq } from '../dto/req.dto';
import { ComboMutationRes } from '../dto/res.dto';

/**
 * Usecase thay đổi trạng thái kinh doanh của gói Combo (AVAILABLE <-> INACTIVE).
 */
export interface ChangeComboStatusUsecase {
  /**
   * Thay đổi trạng thái kinh doanh của một gói Combo.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm combo theo `comboId` thuộc `branchId` của quản lý.
   * 3. Cập nhật trường `status` sang giá trị mới (AVAILABLE hoặc INACTIVE).
   * 4. Tính toán lại tồn kho ảo và tính sẵn sàng của combo.
   * 5. Lưu cập nhật vào database và trả về `ComboMutationRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param comboId - ID định danh duy nhất của Combo cần đổi trạng thái
   * @param req - DTO chứa trạng thái mới
   * @returns Kết quả cập nhật trạng thái và dữ liệu Combo đã cập nhật
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws NotFoundException khi không tìm thấy Combo tương ứng trong chi nhánh
   */
  changeComboStatus(
    managerUserId: string,
    comboId: string,
    req: ChangeComboStatusReq,
  ): Promise<ComboMutationRes>;
}
