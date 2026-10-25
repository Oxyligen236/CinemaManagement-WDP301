import { ProcessPosCashPaymentReq } from '../dto/req.dto';
import { PosCashPaymentResultRes } from '../dto/res.dto';

/**
 * Nghiệp vụ xác nhận thanh toán tiền mặt tại quầy POS.
 */
export interface ConfirmPosCashPaymentUsecase {
  /**
   * Xử lý thanh toán tiền mặt tại quầy, khóa ghế vĩnh viễn, phát hành vé, trừ kho và hoàn tất đơn hàng.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId, xác thực chi nhánh và trạng thái PENDING.
   * 2. Kiểm tra số tiền khách đưa: cashReceived >= finalAmount.
   * 3. Ghi nhận thanh toán tiền mặt qua PaymentContract (CASH, SUCCESS).
   * 4. Khóa ghế từ RESERVED sang BOOKED qua ShowtimeBookingService.
   * 5. Phát hành vé xem phim trạng thái VALID qua TicketContract.
   * 6. Khấu trừ tồn kho bắp nước (nếu có) qua ProductContract.
   * 7. Cập nhật trạng thái đơn hàng sang PAID và paymentMethod sang CASH.
   * 8. Phát tán OrderPaidEvent qua internal event bus.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param orderId - Mã định danh đơn hàng cần thanh toán
   * @param request - Dữ liệu số tiền mặt thu từ khách hàng
   * @returns PosCashPaymentResultRes Kết quả thanh toán tiền mặt kèm tiền thừa và vé đã xuất
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc chi nhánh của nhân viên
   * @throws BadRequestException khi đơn hàng không ở trạng thái PENDING hoặc tiền khách đưa không đủ
   */
  confirmPosCashPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: ProcessPosCashPaymentReq,
  ): Promise<PosCashPaymentResultRes>;
}
