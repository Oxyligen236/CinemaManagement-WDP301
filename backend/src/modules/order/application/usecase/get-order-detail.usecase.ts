import { OrderDetailRes } from '../dto/res.dto';

/**
 * Lấy thông tin chi tiết một đơn hàng theo orderId
 *
 * Quy trình nghiệp vụ:
 * 1. Tìm đơn hàng theo orderId trong collection orders
 * 2. Lấy danh sách vé thông qua TicketContract (TICKET_CONTRACT)
 * 3. Lấy danh sách sản phẩm F&B từ product_orders và tra cứu thông tin sản phẩm qua ProductContract (PRODUCT_CONTRACT)
 * 4. Tra cứu thông tin khuyến mãi qua PromotionContract (PROMOTION_CONTRACT) nếu đơn có promotionId
 * 5. Tổng hợp và trả về OrderDetailRes
 *
 * @param orderId - ID đơn hàng cần xem chi tiết
 * @returns OrderDetailRes Chi tiết đơn hàng gồm vé, sản phẩm và khuyến mãi
 * @throws NotFoundException khi không tìm thấy đơn hàng
 */
export interface GetOrderDetailUsecase {
  getOrderDetail(orderId: string): Promise<OrderDetailRes>;
}
