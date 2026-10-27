import { Page } from '../../../../common/dto/page.dto';
import { QueryMyOrdersReq } from '../dto/req.dto';
import { OrderSummaryRes } from '../dto/res.dto';

/**
 * Lấy lịch sử đơn hàng cá nhân của khách hàng
 *
 * Quy trình nghiệp vụ:
 * 1. Lọc đơn hàng theo userId từ phiên xác thực và status nếu có
 * 2. Đếm số lượng vé và kiểm tra sự tồn tại của sản phẩm F&B đi kèm
 * 3. Trả về danh sách đơn hàng dạng phân trang Page<OrderSummaryRes>
 *
 * @param userId - ID người dùng cần lấy lịch sử đơn
 * @param query - QueryMyOrdersReq chứa điều kiện lọc và phân trang
 * @returns Page<OrderSummaryRes> Danh sách đơn hàng phân trang
 */
export interface GetMyOrderHistoryUsecase {
  getMyOrderHistory(
    userId: string,
    query: QueryMyOrdersReq,
  ): Promise<Page<OrderSummaryRes>>;
}
