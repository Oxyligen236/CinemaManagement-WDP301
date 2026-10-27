import { ChangeItemStatusReq } from '../dto/req.dto';
import { ItemMutationRes } from '../dto/res.dto';

/**
 * Usecase chuyển đổi trạng thái kinh doanh của một sản phẩm đơn lẻ (Item).
 */
export interface ChangeItemStatusUsecase {
  /**
   * Thay đổi trạng thái sản phẩm sang AVAILABLE, OUT_OF_STOCK hoặc INACTIVE.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm sản phẩm theo itemId và branchId.
   * 3. Kiểm tra tính hợp lệ của trạng thái mới:
   *    - Nếu chuyển sang AVAILABLE nhưng stockQuantity = 0 -> tự động chuyển thành OUT_OF_STOCK.
   * 4. Cập nhật trạng thái sản phẩm vào database.
   * 5. Trả về thông tin sản phẩm sau khi cập nhật trạng thái `ItemMutationRes`.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param itemId - Mã định danh của sản phẩm
   * @param req - DTO chứa trạng thái mới
   * @returns Kết quả thay đổi trạng thái và dữ liệu sản phẩm
   * @throws NotFoundException khi không tìm thấy sản phẩm trong chi nhánh
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  changeItemStatus(
    managerUserId: string,
    itemId: string,
    req: ChangeItemStatusReq,
  ): Promise<ItemMutationRes>;
}
