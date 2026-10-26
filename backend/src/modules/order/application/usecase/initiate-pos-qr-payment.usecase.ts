import { InitiatePosQrPaymentReq } from '../dto/req.dto';
import { PosQrPaymentRes } from '../dto/res.dto';

/**
 * Nghiệp vụ khởi tạo thanh toán mã QR động tại quầy POS.
 */
export interface InitiatePosQrPaymentUsecase {
  /**
   * Tạo giao dịch thanh toán QR động cho đơn hàng quầy và trả về chuỗi VietQR hoặc link thanh toán.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo orderId, xác thực chi nhánh và trạng thái PENDING.
   * 2. Gọi PaymentContract sinh mã QR động với số tiền totalAmount của đơn hàng.
   * 3. Trả về thông tin QR code và mã giao dịch để màn hình phụ hoặc thiết bị quét QR hiển thị.
   *
   * @param staffContext - Thông tin định danh và chi nhánh của nhân viên thực hiện
   * @param orderId - Mã định danh đơn hàng cần thanh toán QR
   * @param request - Phương thức thanh toán QR được chọn (VNPAY, MOMO, ZALOPAY, ...)
   * @returns PosQrPaymentRes Thông tin mã QR và giao dịch thanh toán
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc chi nhánh của nhân viên
   * @throws BadRequestException khi đơn hàng không ở trạng thái PENDING
   */
  initiatePosQrPayment(
    staffContext: { staffId: string; branchId: string },
    orderId: string,
    request: InitiatePosQrPaymentReq,
  ): Promise<PosQrPaymentRes>;
}
