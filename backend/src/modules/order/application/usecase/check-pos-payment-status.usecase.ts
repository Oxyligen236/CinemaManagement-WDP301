import { PosCashPaymentResultRes, PosQrPaymentRes } from '../dto/res.dto';

/**
 * Nghiệp vụ kiểm tra trạng thái thanh toán đơn hàng quầy POS.
 */
export interface CheckPosPaymentStatusUsecase {
  /**
   * Tra cứu kết quả thanh toán từ cổng giao dịch; nếu đã thanh toán thành công thì tự động hoàn tất đơn hàng.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId và xác thực chi nhánh.
   * 2. Nếu đơn hàng đã PAID, trả về kết quả đã hoàn tất.
   * 3. Gọi PaymentContract kiểm tra trạng thái giao dịch thanh toán.
   * 4. Nếu thanh toán SUCCESS:
   *    a. Khóa ghế sang BOOKED qua ShowtimeBookingService.
   *    b. Sinh vé xem phim VALID qua TicketContract.
   *    c. Khấu trừ tồn kho F&B qua ProductContract.
   *    d. Cập nhật đơn hàng sang PAID.
   *    e. Phát tán OrderPaidEvent qua internal event bus.
   * 5. Trả về thông tin trạng thái thanh toán hiện tại.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param orderId - Mã định danh đơn hàng cần kiểm tra
   * @returns Kết quả thanh toán và trạng thái hoàn tất đơn hàng
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc chi nhánh của nhân viên
   */
  checkPosPaymentStatus(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
  ): Promise<PosCashPaymentResultRes | PosQrPaymentRes>;
}
