import { BranchConcessionCatalogRes } from '../dto/res.dto';

/**
 * Usecase lấy danh mục bắp nước & combo còn hàng của một chi nhánh phục vụ bán tại quầy POS.
 */
export interface GetBranchConcessionsUsecase {
  /**
   * Lấy danh mục sản phẩm và combo còn hàng tại chi nhánh.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh tồn tại và đang hoạt động.
   * 2. Truy vấn các sản phẩm đơn lẻ (items) có trạng thái AVAILABLE và tồn kho > 0.
   * 3. Truy vấn các gói combo có trạng thái AVAILABLE và tính toán tồn kho khả dụng dựa trên các món thành phần.
   * 4. Lọc bỏ các combo không đủ tồn kho (availableStock <= 0).
   * 5. Tổng hợp và trả về catalog bắp nước cho chi nhánh.
   *
   * @param branchId - Mã chi nhánh cần lấy danh mục
   * @returns Danh mục bắp nước và combo khả dụng của chi nhánh
   * @throws NotFoundException khi không tìm thấy chi nhánh hợp lệ
   */
  getBranchConcessions(branchId: string): Promise<BranchConcessionCatalogRes>;
}
