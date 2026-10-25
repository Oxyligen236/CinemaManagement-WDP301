import { AdjustItemStockReq } from '../dto/req.dto';
import { StockAdjustmentRes } from '../dto/res.dto';

/**
 * Usecase điều chỉnh số lượng tồn kho của một sản phẩm đơn lẻ (Item).
 */
export interface AdjustItemStockUsecase {
  /**
   * Điều chỉnh số lượng tồn kho theo loại điều chỉnh: nhập thêm (ADD), chốt kiểm kê (SET) hoặc xuất hao hụt (SUBTRACT).
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Tìm kiếm sản phẩm theo itemId và branchId.
   * 3. Tính toán số lượng tồn kho mới dựa trên loại điều chỉnh:
   *    - ADD: tồn cũ + quantity
   *    - SET: quantity (chốt số thực tế)
   *    - SUBTRACT: tồn cũ - quantity (nếu < 0 thì báo lỗi)
   * 4. Tự động cập nhật trạng thái kinh doanh:
   *    - Nếu tồn kho mới = 0 và đang AVAILABLE -> OUT_OF_STOCK
   *    - Nếu tồn kho mới > 0 và đang OUT_OF_STOCK -> AVAILABLE
   *    - Nếu đang INACTIVE -> giữ nguyên INACTIVE
   * 5. Lưu vào database và trả về `StockAdjustmentRes`.
   *
   * @param managerUserId - ID của quản lý thực hiện
   * @param itemId - Mã định danh của sản phẩm
   * @param req - DTO chứa thông tin điều chỉnh kho
   * @returns Kết quả điều chỉnh tồn kho thành công
   * @throws NotFoundException khi không tìm thấy sản phẩm
   * @throws BadRequestException khi số lượng tồn sau điều chỉnh âm
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  adjustItemStock(
    managerUserId: string,
    itemId: string,
    req: AdjustItemStockReq,
  ): Promise<StockAdjustmentRes>;
}
