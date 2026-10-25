import { UpdateComboReq } from '../dto/req.dto';
import { ComboMutationRes } from '../dto/res.dto';

/**
 * Usecase cập nhật thông tin gói Combo cho chi nhánh.
 */
export interface UpdateComboUsecase {
  /**
   * Cập nhật thông tin combo (tên, giá bán, mô tả, danh sách món thành phần, ảnh).
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm combo theo `comboId` và xác nhận thuộc chi nhánh của quản lý.
   * 3. Nếu cập nhật tên combo: kiểm tra trùng tên với các combo khác trong cùng chi nhánh.
   * 4. Nếu cập nhật danh sách món con (`items`):
   *    - Kiểm tra các món con tồn tại và thuộc cùng `branchId`.
   * 5. Cập nhật `imageKey` mới nếu có tải file ảnh lên qua StorageInterceptor (hoặc giữ nguyên nếu không).
   * 6. Cập nhật các trường thông tin được cung cấp trong database.
   * 7. Tính toán lại tồn kho ảo động và trả về dữ liệu `ComboMutationRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param comboId - ID định danh duy nhất của Combo cần cập nhật
   * @param req - DTO chứa thông tin cập nhật
   * @param imageKey - Storage key trên S3 nếu có ảnh mới
   * @returns Kết quả cập nhật thành công và dữ liệu Combo đã sửa
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws NotFoundException khi không tìm thấy combo hoặc món con thành phần
   * @throws ConflictException khi tên combo cập nhật bị trùng với combo khác cùng chi nhánh
   * @throws BadRequestException khi món con không thuộc chi nhánh
   */
  updateCombo(
    managerUserId: string,
    comboId: string,
    req: UpdateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes>;
}
