import { CancelOrderRes } from '../dto/res.dto';

/**
 * Nghiệp vụ hủy đơn hàng đang chờ thanh toán và giải phóng ghế.
 */
export interface CancelOrderUsecase {
  /**
   * Hủy đơn hàng PENDING của khách hàng, nhân viên hoặc quản trị viên.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId, ném NotFoundException nếu không tìm thấy.
   * 2. Xác thực quyền của actor (Customer chỉ hủy đơn của mình, Staff hủy đơn chi nhánh, Admin hủy mọi đơn).
   * 3. Kiểm tra trạng thái đơn: chỉ cho phép hủy đơn PENDING.
   * 4. Cập nhật trạng thái đơn thành CANCELLED.
   * 5. Tra cứu SeatOrder và gọi ShowtimeBookingService.releaseSeats giải phóng ghế đã giữ nếu có.
   * 6. Phát tán OrderCancelledEvent qua internal event bus.
   *
   * @param orderId - Mã định danh đơn hàng cần hủy
   * @param actor - Thông tin người thực hiện gồm { userId: string; role: string; branchId?: string }
   * @param reason - Lý do hủy đơn (tùy chọn)
   * @returns CancelOrderRes Thông tin xác nhận hủy đơn hàng
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi không có quyền hủy đơn hàng
   * @throws BadRequestException khi đơn hàng không ở trạng thái PENDING
   */
  cancelOrder(
    orderId: string,
    actor: { userId: string; role: string; branchId?: string },
    reason?: string,
  ): Promise<CancelOrderRes>;
}
