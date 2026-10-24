import { Page } from '../../../../common/dto/page.dto';
import { QueryStaffOrdersReq } from '../dto/req.dto';
import { OrderSummaryRes } from '../dto/res.dto';

/**
 * Tra cứu đơn hàng quầy dành cho nhân viên rạp (Staff)
 *
 * Quy trình nghiệp vụ:
 * 1. Lọc đơn hàng theo điều kiện trạng thái và ngày tạo đơn
 * 2. Đếm số lượng vé và kiểm tra sản phẩm đi kèm
 * 3. Trả về danh sách đơn hàng dạng phân trang Page<OrderSummaryRes>
 *
 * @param query - QueryStaffOrdersReq chứa điều kiện lọc và phân trang
 * @returns Page<OrderSummaryRes> Danh sách đơn hàng phân trang
 */
export interface QueryStaffOrdersUsecase {
  queryStaffOrders(query: QueryStaffOrdersReq): Promise<Page<OrderSummaryRes>>;
}
