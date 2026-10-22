import { CreateBookingOrderReq } from '../dto/req.dto';
import { BookingSummaryRes } from '../dto/res.dto';

/**
 * Tạo đơn đặt vé ở trạng thái PENDING và giữ ghế
 *
 * Quy trình nghiệp vụ:
 * 1. Kiểm tra tính hợp lệ của ghế và gọi ShowtimeBookingService để giữ ghế (RESERVED)
 * 2. Lưu đơn hàng và chi tiết ghế/sản phẩm vào database
 * 3. Đưa job kiểm tra hết hạn vào hàng đợi với thời gian delay cấu hình
 * 4. Phát tán OrderCreatedEvent qua internal event bus
 *
 * @param userId - ID người dùng đặt vé
 * @param request - Dữ liệu yêu cầu đặt vé gồm showtimeId, seatShowtimeIds, products, promotionCode
 * @returns BookingSummaryRes Thông tin tóm tắt đơn đặt vé kèm thời gian hết hạn
 * @throws ConflictException khi ghế bị trùng hoặc đã có người giữ
 */
export interface CreateBookingOrderUsecase {
  createBookingOrder(
    userId: string,
    request: CreateBookingOrderReq,
  ): Promise<BookingSummaryRes>;
}
