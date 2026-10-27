import { CreateItemReq } from '../dto/req.dto';
import { ItemMutationRes } from '../dto/res.dto';

/**
 * Usecase tạo mới sản phẩm đơn lẻ (Item) cho chi nhánh, hỗ trợ lưu trữ imageKey từ file upload trực tiếp.
 */
export interface CreateItemUsecase {
  /**
   * Tạo mặt hàng F&B mới thuộc chi nhánh của quản lý.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Kiểm tra trùng tên sản phẩm trong cùng chi nhánh.
   * 3. Gán `imageKey` nếu có file ảnh upload qua StorageInterceptor (hoặc lấy từ `req.imageKey`).
   * 4. Tạo document `Item` mới với trạng thái mặc định (AVAILABLE hoặc OUT_OF_STOCK nếu stockQuantity = 0).
   * 5. Lưu vào database và trả về thông tin `ItemMutationRes`.
   *
   * @param managerUserId - ID của quản lý chi nhánh thực hiện
   * @param req - DTO chứa thông tin sản phẩm
   * @param imageKey - Storage key trên S3 do StorageInterceptor cung cấp (nếu có file đính kèm)
   * @returns Kết quả tạo thành công và dữ liệu Item mới
   * @throws ForbiddenException khi tài khoản không có quyền hoặc không thuộc chi nhánh hợp lệ
   * @throws ConflictException khi tên sản phẩm đã tồn tại trong chi nhánh
   */
  createItem(
    managerUserId: string,
    req: CreateItemReq,
    imageKey?: string,
  ): Promise<ItemMutationRes>;
}
