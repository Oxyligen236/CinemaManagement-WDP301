import { ApplyPromotionReq } from '../dto/req.dto';
import { BookingSummaryRes } from '../dto/res.dto';

/**
 * Nghiệp vụ áp dụng mã khuyến mãi (voucher/coupon) vào đơn đặt vé trực tuyến hoặc tại quầy POS.
 */
export interface ApplyPromotionUsecase {
  /**
   * Áp dụng mã giảm giá vào đơn đặt vé và tính toán lại số tiền thanh toán cuối cùng.
   *
   * Quy trình nghiệp vụ:
   * 1. Tra cứu đơn hàng theo `orderId`, ném NotFoundException nếu không tìm thấy đơn hàng.
   * 2. Xác thực quyền thao tác của người thực hiện (actor):
   *    - Khách hàng (Online/Customer): kiểm tra đơn hàng thuộc quyền sở hữu của `userId`.
   *    - Nhân viên quầy (POS Staff): kiểm tra đơn hàng thuộc chi nhánh phụ trách (`branchId`).
   * 3. Kiểm tra trạng thái đơn hàng: chỉ cho phép đơn ở trạng thái PENDING và thời hạn giữ chỗ chưa hết hạn.
   * 4. Tính toán tổng giá trị gốc của đơn hàng (tiền vé + tiền combo sản phẩm bắp nước).
   * 5. Gọi contract của module Promotion để thẩm định tính hợp lệ của mã khuyến mãi (mã tồn tại, kích hoạt, trong thời gian hiệu lực, giá trị đơn tối thiểu, số lượt dùng).
   * 6. Tính toán số tiền chiết khấu và cập nhật thông tin khuyến mãi (`promotionId`, `totalAmount`) vào cơ sở dữ liệu.
   * 7. Trả về thông tin tóm tắt đặt vé đã được cập nhật số tiền chiết khấu và tổng thanh toán mới (kèm chi tiết promotion).
   *
   * @param actor - Định danh khách hàng (string) hoặc thông tin ngữ cảnh người thực hiện { userId?: string; staffId?: string; role?: string; branchId?: string }
   * @param orderId - Mã định danh đơn hàng cần áp dụng khuyến mãi
   * @param request - Dữ liệu yêu cầu chứa mã khuyến mãi (`promotionCode`)
   * @returns BookingSummaryRes Thông tin tóm tắt đơn hàng sau khi đã áp dụng mã giảm giá thành công
   * @throws NotFoundException khi không tìm thấy đơn hàng
   * @throws ForbiddenException khi đơn hàng không thuộc về người dùng hoặc không thuộc chi nhánh của nhân viên
   * @throws BadRequestException khi đơn không ở trạng thái PENDING, đã hết hạn giữ chỗ hoặc mã khuyến mãi không hợp lệ
   */
  applyPromotion(
    actor:
      | string
      | {
          userId?: string;
          staffId?: string;
          role?: string;
          branchId?: string;
        },
    orderId: string,
    request: ApplyPromotionReq,
  ): Promise<BookingSummaryRes>;
}
