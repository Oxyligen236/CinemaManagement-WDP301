import { ItemRes } from '../dto/res.dto';

/**
 * Usecase lấy thông tin chi tiết một sản phẩm đơn lẻ (Item) theo itemId.
 */
export interface GetItemDetailUsecase {
  /**
   * Lấy chi tiết thông tin của sản phẩm đơn lẻ theo itemId trong chi nhánh.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm sản phẩm theo itemId và branchId.
   * 3. Tính toán cờ `isLowStock` dựa trên số lượng tồn kho và ngưỡng cảnh báo.
   * 4. Trả về thông tin chi tiết `ItemRes`.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param itemId - Mã định danh của sản phẩm
   * @returns Thông tin chi tiết của sản phẩm
   * @throws NotFoundException khi không tìm thấy sản phẩm trong chi nhánh
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  getItemDetail(managerUserId: string, itemId: string): Promise<ItemRes>;
}
