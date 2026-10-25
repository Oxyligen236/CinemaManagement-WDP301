import { DeleteMutationRes } from '../dto/res.dto';

/**
 * Usecase xóa sản phẩm đơn lẻ (Item) khỏi chi nhánh.
 */
export interface DeleteItemUsecase {
  /**
   * Xóa một sản phẩm đơn lẻ theo itemId thuộc chi nhánh.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm sản phẩm theo itemId và branchId.
   * 3. Xóa sản phẩm khỏi database.
   * 4. Trả về `DeleteMutationRes` xác nhận xóa thành công.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param itemId - Mã định danh của sản phẩm cần xóa
   * @returns Kết quả thông báo xóa thành công và ID sản phẩm
   * @throws NotFoundException khi không tìm thấy sản phẩm trong chi nhánh
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  deleteItem(managerUserId: string, itemId: string): Promise<DeleteMutationRes>;
}
