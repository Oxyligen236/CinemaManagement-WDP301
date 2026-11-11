import { CancelOrderRes } from '../dto/res.dto';

/**
 * Nghiệp vụ hủy đơn hàng đang chờ thanh toán (PENDING) và giải phóng ghế giữ chỗ,
 * hỗ trợ cả đơn hàng trực tuyến của khách hàng và đơn hàng tại quầy POS của nhân viên.
 */
export interface CancelOrderUsecase {
  /**
   * Hủy đơn hàng đang chờ thanh toán.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId, ném NotFoundException nếu không tìm thấy đơn hàng.
   * 2. Phân hóa lỗi theo trạng thái đơn hàng:
   *    - EXPIRED: ném BadRequestException('Đơn hàng đã hết hạn giữ chỗ (10 phút), không thể hủy')
   *    - CANCELLED: ném BadRequestException('Đơn hàng đã được hủy trước đó')
   *    - PAID: ném BadRequestException('Đơn hàng đã thanh toán thành công, không thể hủy')
   *    - Khác PENDING: ném BadRequestException('Chỉ có thể hủy đơn hàng đang chờ thanh toán (PENDING)')
   * 3. Lazy Expiration: Nếu PENDING nhưng thời gian tạo quá 10 phút (ORDER_HOLD_TIMEOUT_MS),
   *    tự động gọi expireOrder và ném BadRequestException('Đơn hàng đã hết hạn giữ chỗ (10 phút), không thể hủy').
   * 4. Xác thực quyền thực hiện của actor:
   *    - Khách hàng (USER/CUSTOMER): chỉ hủy được đơn hàng do chính mình tạo (order.userId === actor.userId).
   *    - Nhân viên quầy (STAFF): chỉ hủy được đơn hàng thuộc chi nhánh phụ trách (order.branchId === actor.branchId).
   *    - Quản trị viên (ADMIN): có toàn quyền hủy đơn hàng trên hệ thống.
   * 5. Tra cứu danh sách SeatOrder liên quan và gọi ShowtimeBookingService.releaseSeats giải phóng các ghế giữ về EMPTY.
   * 6. Cập nhật trạng thái đơn hàng thành CANCELLED trong CSDL và ghi nhận lý do hủy nếu có.
   * 7. Phát tán sự kiện OrderCancelledEvent qua internal event bus.
   *
   * @param orderId - Mã định danh đơn hàng cần hủy
   * @param actor - Thông tin người thực hiện hủy { userId: string; role: string; branchId?: string }
   * @param reason - Lý do hủy đơn hàng (tùy chọn)
   * @returns CancelOrderRes Thông tin xác nhận hủy đơn hàng kèm thời gian hủy
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws BadRequestException khi đơn hàng không hợp lệ, đã hết hạn, đã hủy hoặc đã thanh toán
   * @throws ForbiddenException khi người thực hiện không có quyền hủy đơn hàng này
   */
  cancelOrder(
    orderId: string,
    actor: { userId: string; role: string; branchId?: string },
    reason?: string,
  ): Promise<CancelOrderRes>;
}
