import { QueryBranchItemsReq } from '../dto/req.dto';
import { ItemRes } from '../dto/res.dto';
import { Page } from '../../../../common/dto/page.dto';

/**
 * Usecase truy vấn danh sách sản phẩm đơn lẻ (Item) phân trang theo chi nhánh của quản lý.
 */
export interface QueryBranchItemsUsecase {
  /**
   * Truy vấn danh sách sản phẩm có phân trang, hỗ trợ tìm kiếm và bộ lọc.
   *
   * Quy trình nghiệp vụ:
   * 1. Xác thực chi nhánh hoạt động của quản lý đăng nhập.
   * 2. Xây dựng điều kiện lọc theo branchId, search (tên), danh mục, trạng thái, và cờ tồn kho thấp (lowStockOnly).
   * 3. Thực hiện truy vấn đếm tổng số bản ghi và lấy danh sách sản phẩm theo trang.
   * 4. Tính toán cờ cảnh báo `isLowStock` cho từng sản phẩm.
   * 5. Trả về đối tượng `Page<ItemRes>` chuẩn phân trang.
   *
   * @param managerUserId - ID của quản lý thực hiện truy vấn
   * @param query - DTO chứa tham số phân trang và các bộ lọc tìm kiếm
   * @returns Trang dữ liệu danh sách sản phẩm `Page<ItemRes>`
   * @throws ForbiddenException khi tài khoản quản lý không có chi nhánh hợp lệ
   */
  queryBranchItems(
    managerUserId: string,
    query: QueryBranchItemsReq,
  ): Promise<Page<ItemRes>>;
}
