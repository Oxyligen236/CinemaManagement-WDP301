import { Page } from '../../../../common/dto/page.dto';
import { QueryAdminOrdersReq } from '../dto/req.dto';
import { OrderSummaryRes } from '../dto/res.dto';

/**
 * Tra cứu đơn hàng toàn hệ thống dành cho Quản trị viên (Admin)
 *
 * Quy trình nghiệp vụ:
 * 1. Lọc đơn hàng theo userId, trạng thái và khoảng thời gian (fromDate, toDate)
 * 2. Đếm số lượng vé và kiểm tra sản phẩm đi kèm
 * 3. Trả về danh sách đơn hàng dạng phân trang Page<OrderSummaryRes>
 *
 * @param query - QueryAdminOrdersReq chứa điều kiện lọc nâng cao và phân trang
 * @returns Page<OrderSummaryRes> Danh sách đơn hàng phân trang
 */
export interface QueryAdminOrdersUsecase {
  queryAdminOrders(query: QueryAdminOrdersReq): Promise<Page<OrderSummaryRes>>;
}
