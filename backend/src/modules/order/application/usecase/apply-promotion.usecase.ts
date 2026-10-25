import { ApplyPromotionReq } from '../dto/req.dto';
import { BookingSummaryRes } from '../dto/res.dto';

/**
 * Nghiệp vụ áp dụng mã khuyến mãi (voucher/coupon) vào đơn đặt vé của khách hàng.
 */
export interface ApplyPromotionUsecase {
  /**
   * Áp dụng mã giảm giá vào đơn đặt vé và tính lại số tiền thanh toán cuối cùng.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo `orderId`, xác thực quyền sở hữu của `userId`.
   * 2. Kiểm tra trạng thái đơn hàng: chỉ cho phép đơn ở trạng thái PENDING và thời hạn giữ chỗ chưa hết hạn.
   * 3. Tính toán tổng giá trị gốc của đơn hàng (tiền vé + tiền combo sản phẩm bắp nước).
   * 4. Gọi contract của module Promotion để thẩm định tính hợp lệ của mã khuyến mãi (mã tồn tại, kích hoạt, trong thời gian hiệu lực, giá trị đơn tối thiểu, số lượt dùng).
   * 5. Tính toán số tiền chiết khấu (theo phần trăm hoặc số tiền cố định, áp dụng mức giảm tối đa nếu có) và số tiền thanh toán sau giảm giá.
   * 6. Cập nhật thông tin khuyến mãi (`promotionId`, `totalAmount`) vào cơ sở dữ liệu.
   * 7. Trả về thông tin tóm tắt đặt vé đã được cập nhật số tiền chiết khấu và tổng thanh toán mới (kèm chi tiết promotion).
   *
   * @param userId - Định danh của khách hàng sở hữu đơn hàng.
   * @param orderId - Mã định danh đơn hàng cần áp dụng khuyến mãi.
   * @param request - Dữ liệu yêu cầu chứa mã khuyến mãi (`promotionCode`).
   * @returns Thông tin tóm tắt đơn hàng sau khi đã áp dụng mã giảm giá thành công.
   * @throws NotFoundException khi không tìm thấy đơn hàng.
   * @throws ForbiddenException khi đơn hàng không thuộc về người dùng thực hiện yêu cầu.
   * @throws BadRequestException khi đơn không ở trạng thái PENDING, đã hết hạn giữ chỗ hoặc mã khuyến mãi không hợp lệ.
   */
  applyPromotion(
    userId: string,
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<BookingSummaryRes>;
}
