import { CancelPosOrderReq } from '../dto/req.dto';

/**
 * Nghiệp vụ hủy đơn hàng tại quầy POS và giải phóng ghế đang giữ.
 */
export interface CancelPosOrderUsecase {
  /**
   * Hủy đơn hàng PENDING tại quầy, nhả ghế ngay lập tức và phát tán event hủy đơn.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId và xác thực chi nhánh quản lý.
   * 2. Kiểm tra trạng thái đơn: chỉ cho phép hủy đơn PENDING.
   * 3. Chuyển trạng thái đơn sang CANCELLED.
   * 4. Gọi ShowtimeBookingService giải phóng ghế đang RESERVED về EMPTY.
   * 5. Phát tán OrderCancelledEvent qua internal event bus.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param orderId - Mã định danh đơn hàng cần hủy
   * @param request - Dữ liệu lý do hủy đơn (tùy chọn)
   * @returns Kết quả hủy đơn thành công
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc chi nhánh của nhân viên
   * @throws BadRequestException khi đơn hàng không ở trạng thái PENDING
   */
  cancelPosOrder(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request?: CancelPosOrderReq,
  ): Promise<{ success: boolean; message: string }>;
}
