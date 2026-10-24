import { BookingSummaryRes } from '../dto/res.dto';

/**
 * Lấy thông tin tóm tắt của đơn đặt vé kèm thời gian còn lại
 *
 * Quy trình nghiệp vụ:
 * 1. Tìm đơn hàng theo orderId, ném NotFoundException nếu không tìm thấy
 * 2. Kiểm tra quyền sở hữu của userId, ném ForbiddenException nếu không phải chủ sở hữu
 * 3. Lấy thông tin ghế và sản phẩm của đơn hàng
 * 4. Tính toán số giây còn lại trước khi hết hạn và trả về BookingSummaryRes
 *
 * @param userId - ID người dùng yêu cầu xem đơn
 * @param orderId - ID đơn hàng cần xem tóm tắt
 * @returns BookingSummaryRes Thông tin tóm tắt đơn đặt vé
 * @throws NotFoundException khi không tìm thấy đơn hàng
 * @throws ForbiddenException khi người dùng không sở hữu đơn hàng
 */
export interface GetBookingSummaryUsecase {
  getBookingSummary(
    userId: string,
    orderId: string,
  ): Promise<BookingSummaryRes>;
}
