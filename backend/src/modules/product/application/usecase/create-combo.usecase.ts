import { CreateComboReq } from '../dto/req.dto';
import { ComboMutationRes } from '../dto/res.dto';

/**
 * Usecase tạo mới gói Combo cho chi nhánh, kết hợp nhiều mặt hàng lẻ với tồn kho ảo động.
 */
export interface CreateComboUsecase {
  /**
   * Tạo gói Combo mới thuộc chi nhánh của quản lý.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Kiểm tra trùng tên combo trong cùng chi nhánh.
   * 3. Kiểm tra danh sách món con (`items`):
   *    - Phải có ít nhất 1 món thành phần.
   *    - Tất cả món con phải tồn tại trong cơ sở dữ liệu và thuộc cùng `branchId` với combo.
   * 4. Gán `imageKey` nếu có file ảnh upload qua StorageInterceptor (hoặc lấy từ `req.imageKey`).
   * 5. Tạo document `Combo` mới với trạng thái mặc định (AVAILABLE hoặc theo req).
   * 6. Tính toán tồn kho ảo động (`availableStock`), `isAvailable`, `originalTotalPrice` và `savingsAmount`.
   * 7. Lưu vào database và trả về thông tin `ComboMutationRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param req - DTO chứa thông tin tạo combo và danh sách món thành phần
   * @param imageKey - Storage key trên S3 do StorageInterceptor cung cấp (nếu có file đính kèm)
   * @returns Kết quả tạo thành công và dữ liệu Combo mới
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws BadRequestException khi món con không thuộc chi nhánh hoặc trùng lặp món trong combo
   * @throws ConflictException khi tên combo đã tồn tại trong chi nhánh
   * @throws NotFoundException khi không tìm thấy món con thành phần
   */
  createCombo(
    managerUserId: string,
    req: CreateComboReq,
    imageKey?: string,
  ): Promise<ComboMutationRes>;
}
