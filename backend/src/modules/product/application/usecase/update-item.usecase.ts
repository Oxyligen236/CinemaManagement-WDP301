import { UpdateItemReq } from '../dto/req.dto';
import { ItemMutationRes } from '../dto/res.dto';

/**
 * Usecase cập nhật thông tin sản phẩm đơn lẻ (Item) trong chi nhánh.
 */
export interface UpdateItemUsecase {
  /**
   * Cập nhật thông tin chi tiết của một sản phẩm đơn lẻ.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm sản phẩm theo itemId và branchId.
   * 3. Kiểm tra tính duy nhất của tên sản phẩm mới (nếu có thay đổi tên).
   * 4. Cập nhật các trường thông tin (tên, danh mục, kích cỡ, giá bán, giá vốn, ngưỡng cảnh báo, mô tả).
   * 5. Gán ảnh mới nếu có tải lên (cập nhật `imageKey`).
   * 6. Lưu vào database và trả về thông tin `ItemMutationRes`.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param itemId - Mã định danh duy nhất của sản phẩm cần cập nhật
   * @param req - DTO chứa thông tin cập nhật
   * @param imageKey - Storage key trên S3 nếu có file ảnh mới
   * @returns Kết quả cập nhật thành công và dữ liệu Item sau khi sửa
   * @throws NotFoundException khi không tìm thấy sản phẩm thuộc chi nhánh
   * @throws ConflictException khi tên mới trùng với sản phẩm khác cùng chi nhánh
   * @throws ForbiddenException khi quản lý không có chi nhánh hợp lệ
   */
  updateItem(
    managerUserId: string,
    itemId: string,
    req: UpdateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes>;
}
